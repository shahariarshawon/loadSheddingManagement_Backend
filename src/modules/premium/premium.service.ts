import { prisma } from '../../config/prisma.js';
import { AppError } from '../../utils/appError.js';
import {
  SubscriptionStatus,
  OutageStatus,
  OutageType,
  Role,
} from '../../generated/prisma/client.js';

export class PremiumService {
  /**
   * Check user's current premium access pass status
   */
  static async getSubscriptionStatus(userId: string) {
    const activeSub = await prisma.subscription.findFirst({
      where: {
        userId,
        status: SubscriptionStatus.ACTIVE,
        endDate: { gt: new Date() },
      },
      orderBy: { endDate: 'desc' },
      include: {
        payments: {
          where: { status: 'SUCCEEDED' },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!activeSub) {
      return {
        hasActivePremium: false,
        subscription: null,
        daysRemaining: 0,
        message: 'No active premium access pass. Purchase a pass to unlock area analytics.',
      };
    }

    const msRemaining = activeSub.endDate.getTime() - Date.now();
    const daysRemaining = Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)));

    return {
      hasActivePremium: true,
      subscription: {
        id: activeSub.id,
        plan: activeSub.plan,
        status: activeSub.status,
        startDate: activeSub.startDate,
        endDate: activeSub.endDate,
        lastPayment: activeSub.payments[0] || null,
      },
      daysRemaining,
      message: 'Active premium access pass',
    };
  }

  /**
   * Premium Area Reliability Analytics
   * Strictly gated by active premium subscription for customers.
   * Calculates actual outage duration, restoration efficiency, and 30-day grid availability scores from live PostgreSQL records.
   */
  static async getAreaReliabilityAnalytics(
    user: { id: string; role: Role; areaId?: string | null },
    requestedAreaId?: string,
  ) {
    // 1. Authorization Gate: Customers must hold an active premium pass
    if (user.role === Role.CUSTOMER) {
      const activeSub = await prisma.subscription.findFirst({
        where: {
          userId: user.id,
          status: SubscriptionStatus.ACTIVE,
          endDate: { gt: new Date() },
        },
      });

      if (!activeSub) {
        throw AppError.forbidden(
          'Premium Area Reliability Analytics is restricted to active pass holders. Please purchase an access pass via POST /api/v1/payments/checkout.',
        );
      }
    }

    // 2. Identify target area
    const targetAreaId = requestedAreaId || user.areaId;

    if (!targetAreaId) {
      throw AppError.badRequest(
        'No area specified. Please update your profile area or provide an ?areaId= query parameter.',
      );
    }

    // 3. Fetch area and grid hierarchy
    const area = await prisma.area.findFirst({
      where: { id: targetAreaId, deletedAt: null },
      include: {
        feeder: {
          include: {
            substation: {
              include: {
                zone: { select: { id: true, name: true, code: true } },
              },
            },
          },
        },
      },
    });

    if (!area) {
      throw AppError.notFound(`Target Area with ID '${targetAreaId}' not found.`);
    }

    // 4. Query all historical and ongoing outages for this area
    const outages = await prisma.outage.findMany({
      where: { areaId: targetAreaId, deletedAt: null },
      orderBy: { startTime: 'desc' },
    });

    // 5. Compute Real Outage Statistics
    const totalOutages = outages.length;
    const plannedOutages = outages.filter((o) => o.type === OutageType.PLANNED).length;
    const unexpectedOutages = outages.filter((o) => o.type === OutageType.UNEXPECTED).length;

    const activeOutages = outages.filter(
      (o) => o.status === OutageStatus.ACTIVE || o.status === OutageStatus.IN_PROGRESS,
    ).length;
    const restoredOutages = outages.filter(
      (o) => o.status === OutageStatus.RESTORED || o.status === OutageStatus.COMPLETED,
    ).length;
    const cancelledOutages = outages.filter((o) => o.status === OutageStatus.CANCELLED).length;

    let totalDowntimeMinutes = 0;
    let totalUnexpectedDowntimeMinutes = 0;
    let completedOutageCount = 0;
    let completedUnexpectedCount = 0;

    for (const outage of outages) {
      if (
        (outage.status === OutageStatus.RESTORED || outage.status === OutageStatus.COMPLETED) &&
        outage.endTime
      ) {
        const durationMin = Math.round(
          (outage.endTime.getTime() - outage.startTime.getTime()) / (1000 * 60),
        );
        if (durationMin > 0) {
          totalDowntimeMinutes += durationMin;
          completedOutageCount++;
          if (outage.type === OutageType.UNEXPECTED) {
            totalUnexpectedDowntimeMinutes += durationMin;
            completedUnexpectedCount++;
          }
        }
      }
    }

    const averageOutageDurationMinutes =
      completedOutageCount > 0 ? Math.round(totalDowntimeMinutes / completedOutageCount) : 0;

    const averageRestorationTimeMinutes =
      completedUnexpectedCount > 0
        ? Math.round(totalUnexpectedDowntimeMinutes / completedUnexpectedCount)
        : 0;

    // 6. Compute 30-Day Grid Availability & Reliability Index
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const past30DaysOutages = outages.filter(
      (o) =>
        o.startTime >= thirtyDaysAgo &&
        (o.status === OutageStatus.RESTORED || o.status === OutageStatus.COMPLETED) &&
        o.endTime,
    );

    let past30DaysDowntimeMinutes = 0;
    for (const o of past30DaysOutages) {
      if (o.endTime) {
        past30DaysDowntimeMinutes += Math.round(
          (o.endTime.getTime() - o.startTime.getTime()) / (1000 * 60),
        );
      }
    }

    const totalMinutesInMonth = 43200; // 30 days * 24 hrs * 60 mins
    const effectiveDowntime = Math.min(past30DaysDowntimeMinutes, totalMinutesInMonth);
    const availabilityPercentage = Number(
      (((totalMinutesInMonth - effectiveDowntime) / totalMinutesInMonth) * 100).toFixed(2),
    );

    const reliabilityRating =
      availabilityPercentage >= 99.0
        ? 'EXCELLENT'
        : availabilityPercentage >= 95.0
          ? 'GOOD'
          : availabilityPercentage >= 85.0
            ? 'MODERATE'
            : 'UNSTABLE';

    // 7. Recent Outage Timeline (top 5 recent)
    const recentIncidents = outages.slice(0, 5).map((o) => {
      const durationMin = o.endTime
        ? Math.round((o.endTime.getTime() - o.startTime.getTime()) / (1000 * 60))
        : null;

      return {
        outageNumber: o.outageNumber,
        title: o.title,
        type: o.type,
        status: o.status,
        startTime: o.startTime,
        endTime: o.endTime,
        durationMinutes: durationMin,
      };
    });

    return {
      area: {
        id: area.id,
        name: area.name,
        postalCode: area.postalCode,
        feeder: {
          name: area.feeder.name,
          code: area.feeder.code,
          maxLoadKw: area.feeder.maxLoadKw,
        },
        substation: {
          name: area.feeder.substation.name,
          capacityKva: area.feeder.substation.capacityKva,
        },
        zone: {
          name: area.feeder.substation.zone.name,
          code: area.feeder.substation.zone.code,
        },
      },
      reliabilitySummary: {
        availabilityPercentage,
        reliabilityRating,
        periodEvaluated: 'Last 30 Days (43,200 Minutes Baseline)',
        past30DaysDowntimeMinutes,
      },
      outageStatistics: {
        totalOutages,
        plannedOutages,
        unexpectedOutages,
        activeOutages,
        restoredOutages,
        cancelledOutages,
      },
      durationMetrics: {
        totalRecordedDowntimeMinutes: totalDowntimeMinutes,
        totalRecordedDowntimeHours: Number((totalDowntimeMinutes / 60).toFixed(2)),
        averageOutageDurationMinutes,
        averageRestorationTimeMinutes,
      },
      recentIncidents,
      generatedAt: new Date().toISOString(),
    };
  }
}

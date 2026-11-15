import { prisma } from '../../config/prisma.js';
import { AppError } from '../../utils/appError.js';
import { parsePagination, buildPaginationMeta } from '../../utils/pagination.js';
import {
  CreateOutageReportInput,
  UpdateOutageReportInput,
  VerifyOutageReportInput,
  RejectOutageReportInput,
} from './outageReport.validation.js';
import {
  ReportStatus,
  ReportSeverity,
  OutageType,
  OutageStatus,
  Role,
  Prisma,
} from '../../generated/prisma/client.js';

export class OutageReportService {
  /**
   * Submit a new customer outage report with 30-minute deduplication guard
   */
  static async createReport(
    customerId: string,
    input: CreateOutageReportInput,
    ipAddress?: string,
  ) {
    const area = await prisma.area.findFirst({
      where: { id: input.areaId, deletedAt: null },
    });

    if (!area) {
      throw AppError.badRequest(`Target Area with ID '${input.areaId}' does not exist.`);
    }

    // Deduplication guard: Check if this customer already submitted a pending report for this area within 30 minutes
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    const existingPending = await prisma.outageReport.findFirst({
      where: {
        customerId,
        areaId: input.areaId,
        status: ReportStatus.PENDING,
        createdAt: { gte: thirtyMinutesAgo },
      },
    });

    if (existingPending) {
      throw AppError.conflict(
        `You have already submitted an outage report (#${existingPending.reportNumber}) for this area within the last 30 minutes. Please wait while our operators review it.`,
      );
    }

    const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const reportNumber = `REP-${datePrefix}-${randomSuffix}`;

    const [report] = await prisma.$transaction([
      prisma.outageReport.create({
        data: {
          reportNumber,
          customerId,
          areaId: input.areaId,
          title: input.title || 'Power Outage Report',
          description: input.description,
          severity: input.severity || ReportSeverity.MEDIUM,
          status: ReportStatus.PENDING,
        },
        include: {
          area: {
            select: {
              id: true,
              name: true,
              postalCode: true,
              feeder: {
                select: {
                  id: true,
                  name: true,
                  substation: { select: { id: true, name: true } },
                },
              },
            },
          },
          customer: {
            select: { id: true, name: true, email: true, phone: true },
          },
        },
      }),
      prisma.auditLog.create({
        data: {
          userId: customerId,
          action: 'OUTAGE_REPORT_SUBMITTED',
          entity: 'OutageReport',
          details: {
            reportNumber,
            areaId: input.areaId,
            severity: input.severity || ReportSeverity.MEDIUM,
          },
          ipAddress: ipAddress || null,
        },
      }),
    ]);

    return report;
  }

  /**
   * List reports submitted by the authenticated customer
   */
  static async getMyReports(customerId: string, query: Record<string, unknown>) {
    const { page, limit, skip, sortBy, sortOrder } = parsePagination(
      query,
      ['createdAt', 'status', 'severity', 'reportNumber'],
      'createdAt',
      'desc',
    );

    const status =
      typeof query.status === 'string' && query.status in ReportStatus
        ? (query.status as ReportStatus)
        : undefined;
    const severity =
      typeof query.severity === 'string' && query.severity in ReportSeverity
        ? (query.severity as ReportSeverity)
        : undefined;

    const where: Prisma.OutageReportWhereInput = {
      customerId,
      ...(status && { status }),
      ...(severity && { severity }),
    };

    const [total, reports] = await Promise.all([
      prisma.outageReport.count({ where }),
      prisma.outageReport.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          area: { select: { id: true, name: true, postalCode: true } },
          outage: {
            select: {
              id: true,
              outageNumber: true,
              title: true,
              status: true,
              startTime: true,
              endTime: true,
            },
          },
        },
      }),
    ]);

    return {
      reports,
      meta: buildPaginationMeta(total, page, limit),
    };
  }

  /**
   * Get single report by ID with ownership/role check
   */
  static async getReportById(id: string, user: { userId: string; role: Role }) {
    const report = await prisma.outageReport.findUnique({
      where: { id },
      include: {
        area: {
          select: {
            id: true,
            name: true,
            postalCode: true,
            feeder: {
              select: {
                id: true,
                name: true,
                code: true,
                substation: {
                  select: {
                    id: true,
                    name: true,
                    code: true,
                    zone: { select: { id: true, name: true, code: true } },
                  },
                },
              },
            },
          },
        },
        customer: { select: { id: true, name: true, email: true, phone: true } },
        verifiedBy: { select: { id: true, name: true, email: true, role: true } },
        outage: {
          select: {
            id: true,
            outageNumber: true,
            title: true,
            status: true,
            type: true,
            startTime: true,
            endTime: true,
          },
        },
      },
    });

    if (!report) {
      throw AppError.notFound(`Outage report with ID '${id}' not found.`);
    }

    // Role-based visibility: Customers can only view their own reports
    if (user.role === Role.CUSTOMER && report.customerId !== user.userId) {
      throw AppError.forbidden('You are not authorized to view this outage report.');
    }

    return report;
  }

  /**
   * Update report details (Customer owner only, strictly while PENDING)
   */
  static async updateReport(
    id: string,
    customerId: string,
    input: UpdateOutageReportInput,
  ) {
    const existing = await prisma.outageReport.findUnique({ where: { id } });

    if (!existing) {
      throw AppError.notFound(`Outage report with ID '${id}' not found.`);
    }

    if (existing.customerId !== customerId) {
      throw AppError.forbidden('You can only update your own outage report.');
    }

    if (existing.status !== ReportStatus.PENDING) {
      throw AppError.badRequest(
        `Cannot edit outage report. Only reports in PENDING status can be updated (current status: ${existing.status}).`,
      );
    }

    const updated = await prisma.outageReport.update({
      where: { id },
      data: {
        ...(input.title !== undefined && { title: input.title }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.severity !== undefined && { severity: input.severity }),
      },
      include: {
        area: { select: { id: true, name: true } },
      },
    });

    return updated;
  }

  /**
   * Withdraw/Cancel an outage report (Author customer or Admin, strictly while PENDING)
   */
  static async withdrawReport(id: string, customerId: string, role: Role) {
    const existing = await prisma.outageReport.findUnique({ where: { id } });

    if (!existing) {
      throw AppError.notFound(`Outage report with ID '${id}' not found.`);
    }

    if (role !== Role.ADMIN && existing.customerId !== customerId) {
      throw AppError.forbidden('You can only withdraw your own outage report.');
    }

    if (existing.status !== ReportStatus.PENDING) {
      throw AppError.badRequest(
        `Cannot withdraw report. Only pending reports can be withdrawn (current status: ${existing.status}).`,
      );
    }

    await prisma.outageReport.delete({ where: { id } });

    return { id, message: 'Outage report withdrawn successfully.' };
  }

  /**
   * Operator/Admin list of all outage reports with filters and pagination
   */
  static async listReports(query: Record<string, unknown>) {
    const { page, limit, skip, sortBy, sortOrder } = parsePagination(
      query,
      ['createdAt', 'status', 'severity', 'reportNumber'],
      'createdAt',
      'desc',
    );

    const status =
      typeof query.status === 'string' && query.status in ReportStatus
        ? (query.status as ReportStatus)
        : undefined;
    const severity =
      typeof query.severity === 'string' && query.severity in ReportSeverity
        ? (query.severity as ReportSeverity)
        : undefined;
    const areaId = typeof query.areaId === 'string' && query.areaId ? query.areaId : undefined;
    const search = typeof query.search === 'string' ? query.search.trim() : undefined;
    const startDate =
      typeof query.startDate === 'string' && !isNaN(Date.parse(query.startDate))
        ? new Date(query.startDate)
        : undefined;
    const endDate =
      typeof query.endDate === 'string' && !isNaN(Date.parse(query.endDate))
        ? new Date(query.endDate)
        : undefined;

    const where: Prisma.OutageReportWhereInput = {
      ...(status && { status }),
      ...(severity && { severity }),
      ...(areaId && { areaId }),
      ...(startDate && { createdAt: { gte: startDate } }),
      ...(endDate && { createdAt: { lte: endDate } }),
      ...(search && {
        OR: [
          { reportNumber: { contains: search, mode: 'insensitive' } },
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { area: { name: { contains: search, mode: 'insensitive' } } },
          { customer: { name: { contains: search, mode: 'insensitive' } } },
        ],
      }),
    };

    const [total, reports] = await Promise.all([
      prisma.outageReport.count({ where }),
      prisma.outageReport.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          area: { select: { id: true, name: true, postalCode: true } },
          customer: { select: { id: true, name: true, email: true, phone: true } },
          verifiedBy: { select: { id: true, name: true, email: true, role: true } },
          outage: {
            select: {
              id: true,
              outageNumber: true,
              title: true,
              status: true,
            },
          },
        },
      }),
    ]);

    return {
      reports,
      meta: buildPaginationMeta(total, page, limit),
    };
  }

  /**
   * Verify an outage report: Links to an existing active outage or spawns an UNEXPECTED outage
   */
  static async verifyReport(
    operatorId: string,
    reportId: string,
    input: VerifyOutageReportInput,
    ipAddress?: string,
  ) {
    const report = await prisma.outageReport.findUnique({
      where: { id: reportId },
      include: {
        area: { select: { id: true, name: true } },
        customer: { select: { id: true, name: true, email: true } },
      },
    });

    if (!report) {
      throw AppError.notFound(`Outage report with ID '${reportId}' not found.`);
    }

    if (report.status !== ReportStatus.PENDING) {
      throw AppError.badRequest(
        `This report cannot be verified because it is already in '${report.status}' status.`,
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      let targetOutageId: string;
      let targetOutageNumber: string;

      if (input.outageId) {
        // Link to existing outage
        const existingOutage = await tx.outage.findFirst({
          where: { id: input.outageId, deletedAt: null },
        });

        if (!existingOutage) {
          throw AppError.notFound(`Specified outage with ID '${input.outageId}' not found.`);
        }

        if (existingOutage.areaId !== report.areaId) {
          throw AppError.badRequest(
            `The specified outage is assigned to a different area than the report area.`,
          );
        }

        targetOutageId = existingOutage.id;
        targetOutageNumber = existingOutage.outageNumber;
      } else {
        // Auto-create unexpected outage incident
        const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const randomSuffix = Math.floor(1000 + Math.random() * 9000);
        targetOutageNumber = `OUT-UNX-${datePrefix}-${randomSuffix}`;

        const newOutage = await tx.outage.create({
          data: {
            outageNumber: targetOutageNumber,
            title: input.title || `Unexpected Outage in ${report.area.name}`,
            description: input.description || report.description,
            areaId: report.areaId,
            type: OutageType.UNEXPECTED,
            status: OutageStatus.ACTIVE,
            startTime: new Date(),
            endTime: input.estimatedRestoreTime ? new Date(input.estimatedRestoreTime) : null,
            createdById: operatorId,
          },
        });

        targetOutageId = newOutage.id;
      }

      // Update report to VERIFIED
      const updatedReport = await tx.outageReport.update({
        where: { id: reportId },
        data: {
          status: ReportStatus.VERIFIED,
          verifiedById: operatorId,
          outageId: targetOutageId,
        },
        include: {
          area: { select: { id: true, name: true } },
          customer: { select: { id: true, name: true, email: true } },
          verifiedBy: { select: { id: true, name: true, email: true, role: true } },
          outage: {
            select: {
              id: true,
              outageNumber: true,
              title: true,
              type: true,
              status: true,
              startTime: true,
              endTime: true,
            },
          },
        },
      });

      // Send In-App Notification to Customer
      await tx.notification.create({
        data: {
          userId: report.customerId,
          title: 'Outage Report Verified',
          message: `Your outage report #${report.reportNumber} has been verified by the power operations team. Incident #${targetOutageNumber} is now active.`,
          type: 'OUTAGE_VERIFIED',
          metadata: {
            reportId: report.id,
            reportNumber: report.reportNumber,
            outageId: targetOutageId,
            outageNumber: targetOutageNumber,
          },
        },
      });

      // Audit Log
      await tx.auditLog.create({
        data: {
          userId: operatorId,
          action: 'OUTAGE_REPORT_VERIFIED',
          entity: 'OutageReport',
          entityId: report.id,
          details: {
            reportNumber: report.reportNumber,
            outageId: targetOutageId,
            outageNumber: targetOutageNumber,
          },
          ipAddress: ipAddress || null,
        },
      });

      return updatedReport;
    });

    return result;
  }

  /**
   * Reject an outage report with mandatory reason
   */
  static async rejectReport(
    operatorId: string,
    reportId: string,
    input: RejectOutageReportInput,
    ipAddress?: string,
  ) {
    const report = await prisma.outageReport.findUnique({
      where: { id: reportId },
    });

    if (!report) {
      throw AppError.notFound(`Outage report with ID '${reportId}' not found.`);
    }

    if (report.status !== ReportStatus.PENDING) {
      throw AppError.badRequest(
        `This report cannot be rejected because it is already in '${report.status}' status.`,
      );
    }

    const [updatedReport] = await prisma.$transaction([
      prisma.outageReport.update({
        where: { id: reportId },
        data: {
          status: ReportStatus.REJECTED,
          verifiedById: operatorId,
          rejectionReason: input.reason,
        },
        include: {
          area: { select: { id: true, name: true } },
          customer: { select: { id: true, name: true, email: true } },
          verifiedBy: { select: { id: true, name: true, email: true, role: true } },
        },
      }),
      prisma.notification.create({
        data: {
          userId: report.customerId,
          title: 'Outage Report Rejected',
          message: `Your outage report #${report.reportNumber} was reviewed and rejected. Reason: ${input.reason}`,
          type: 'REPORT_REJECTED',
          metadata: {
            reportId: report.id,
            reportNumber: report.reportNumber,
            reason: input.reason,
          },
        },
      }),
      prisma.auditLog.create({
        data: {
          userId: operatorId,
          action: 'OUTAGE_REPORT_REJECTED',
          entity: 'OutageReport',
          entityId: report.id,
          details: {
            reportNumber: report.reportNumber,
            reason: input.reason,
          },
          ipAddress: ipAddress || null,
        },
      }),
    ]);

    return updatedReport;
  }
}

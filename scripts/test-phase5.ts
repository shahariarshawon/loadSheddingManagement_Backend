const BASE_URL = 'http://localhost:5000/api/v1';

interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data: T;
  errors?: unknown[];
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, details?: unknown) {
  if (condition) {
    console.log(`  ✅ [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${testName}`, details ?? '');
    failed++;
  }
}

async function request(path: string, options: RequestInit = {}) {
  const url = `${BASE_URL}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  const response = await fetch(url, { ...options, headers });
  let body: ApiResponse;
  try {
    body = (await response.json()) as ApiResponse;
  } catch {
    body = { success: false, message: 'Invalid JSON response', data: null };
  }

  return { status: response.status, body };
}

async function runTests() {
  console.log('🧪 Starting Phase 5 Automated Verification Suite...\n');

  // ==========================================
  // Step 0: Auth Setup
  // ==========================================
  console.log('--- 0. Authentication Setup ---');
  const adminLogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'admin@gridwatch.com', password: 'Admin123!Secure' }),
  });
  assert(adminLogin.status === 200, 'Admin login succeeded');
  const adminToken = (adminLogin.body.data as { accessToken: string }).accessToken;

  const opLogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'operator@gridwatch.com', password: 'User123!Secure' }),
  });
  assert(opLogin.status === 200, 'Operator login succeeded');
  const operatorToken = (opLogin.body.data as { accessToken: string }).accessToken;

  const custLogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'customer@gridwatch.com', password: 'User123!Secure' }),
  });
  assert(custLogin.status === 200, 'Customer 1 login succeeded');
  const customer1Token = (custLogin.body.data as { accessToken: string }).accessToken;

  // Register Customer 2
  const ts = Date.now();
  const cust2Email = `cust2_${ts}@gridwatch.com`;
  const cust2Reg = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Customer Two',
      email: cust2Email,
      password: 'Password123!',
      phone: '+8801700999888',
    }),
  });
  assert(cust2Reg.status === 201, 'Customer 2 registration succeeded');
  const customer2Token = (cust2Reg.body.data as { accessToken: string }).accessToken;

  // Get a target Area and Zone
  const areasRes = await request('/areas?limit=2', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(areasRes.status === 200, 'Areas fetched');
  const targetArea = (areasRes.body.data as Array<{ id: string; name: string }>)[0];
  const targetArea2 = (areasRes.body.data as Array<{ id: string; name: string }>)[1] || targetArea;

  const zonesRes = await request('/zones?limit=1', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(zonesRes.status === 200, 'Zones fetched');
  const targetZone = (zonesRes.body.data as Array<{ id: string; code: string }>)[0];

  // ==========================================
  // Test 1: Customer Outage Reporting & Deduplication
  // ==========================================
  console.log('\n--- 1. Customer Outage Reporting & Deduplication ---');
  const createReportRes = await request('/outage-reports', {
    method: 'POST',
    headers: { Authorization: `Bearer ${customer1Token}` },
    body: JSON.stringify({
      areaId: targetArea.id,
      title: 'Transformer Sparking and Total Blackout',
      description: 'Loud noise heard from transformer, followed by complete blackout across Block C.',
      severity: 'HIGH',
    }),
  });
  assert(createReportRes.status === 201, 'Customer 1 submitted outage report (201)');
  const report1 = createReportRes.body.data as {
    id: string;
    reportNumber: string;
    status: string;
    severity: string;
  };
  assert(report1.status === 'PENDING', 'Report status is PENDING');
  assert(report1.reportNumber.startsWith('REP-'), 'Report number generated with REP- prefix');

  // Deduplication check: same customer, same area within 30 minutes
  const duplicateReportRes = await request('/outage-reports', {
    method: 'POST',
    headers: { Authorization: `Bearer ${customer1Token}` },
    body: JSON.stringify({
      areaId: targetArea.id,
      title: 'Power is out here again',
      description: 'Still no electricity in Block C.',
      severity: 'HIGH',
    }),
  });
  assert(
    duplicateReportRes.status === 409,
    '30-minute deduplication guard blocks duplicate pending report (409 Conflict)',
    duplicateReportRes.body,
  );

  // ==========================================
  // Test 2: Customer Report Management (Read, Update, Ownership)
  // ==========================================
  console.log('\n--- 2. Customer Report Management ---');
  const myReportsRes = await request('/outage-reports/my', {
    headers: { Authorization: `Bearer ${customer1Token}` },
  });
  assert(myReportsRes.status === 200, 'Customer 1 retrieved own reports list');
  const myReports = myReportsRes.body.data as Array<{ id: string }>;
  assert(myReports.some((r) => r.id === report1.id), 'Submitted report found in /my reports');

  const getReportRes = await request(`/outage-reports/${report1.id}`, {
    headers: { Authorization: `Bearer ${customer1Token}` },
  });
  assert(getReportRes.status === 200, 'Customer 1 viewed own report details');

  // Customer 2 tries to view Customer 1 report -> 403 Forbidden
  const cust2ViewRes = await request(`/outage-reports/${report1.id}`, {
    headers: { Authorization: `Bearer ${customer2Token}` },
  });
  assert(
    cust2ViewRes.status === 403,
    'Customer 2 blocked from viewing Customer 1 report (403 Forbidden)',
  );

  // Customer 1 updates pending report
  const updateReportRes = await request(`/outage-reports/${report1.id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${customer1Token}` },
    body: JSON.stringify({
      description: 'Loud noise heard from transformer. Sparks seen flying. Complete blackout.',
      severity: 'CRITICAL',
    }),
  });
  assert(updateReportRes.status === 200, 'Customer 1 updated pending report');
  assert(
    (updateReportRes.body.data as { severity: string }).severity === 'CRITICAL',
    'Report severity updated to CRITICAL',
  );

  // Customer 2 submits a report to test withdrawal
  const cust2ReportRes = await request('/outage-reports', {
    method: 'POST',
    headers: { Authorization: `Bearer ${customer2Token}` },
    body: JSON.stringify({
      areaId: targetArea2.id,
      title: 'Flickering lights in apartment',
      description: 'Frequent voltage fluctuations for 10 minutes.',
      severity: 'LOW',
    }),
  });
  assert(cust2ReportRes.status === 201, 'Customer 2 submitted outage report');
  const report2 = cust2ReportRes.body.data as { id: string };

  const withdrawRes = await request(`/outage-reports/${report2.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${customer2Token}` },
  });
  assert(withdrawRes.status === 200, 'Customer 2 successfully withdrew pending report');

  // ==========================================
  // Test 3: Operator Rejection Workflow
  // ==========================================
  console.log('\n--- 3. Operator Rejection Workflow ---');
  // Customer 2 submits another report to be rejected
  const cust2Report3Res = await request('/outage-reports', {
    method: 'POST',
    headers: { Authorization: `Bearer ${customer2Token}` },
    body: JSON.stringify({
      areaId: targetArea2.id,
      title: 'False alarm test',
      description: 'Tripped breaker inside house, testing reporting.',
      severity: 'LOW',
    }),
  });
  const report3 = cust2Report3Res.body.data as { id: string; reportNumber: string };

  // Operator rejects report
  const rejectRes = await request(`/outage-reports/${report3.id}/reject`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${operatorToken}` },
    body: JSON.stringify({
      reason: 'Internal consumer premises issue (tripped main MCB). Grid supply is normal.',
    }),
  });
  assert(rejectRes.status === 200, 'Operator rejected outage report with reason');
  const rejectedReport = rejectRes.body.data as { status: string; rejectionReason: string };
  assert(rejectedReport.status === 'REJECTED', 'Report status transitioned to REJECTED');

  // Customer 2 checks in-app notification of rejection
  const cust2Notifs = await request('/notifications', {
    headers: { Authorization: `Bearer ${customer2Token}` },
  });
  assert(cust2Notifs.status === 200, 'Customer 2 checked notifications');
  const notifList = (cust2Notifs.body.data as { notifications: Array<{ title: string; message: string }> }).notifications;
  assert(
    notifList.some((n) => n.title.includes('Outage Report Rejected')),
    'Customer 2 received in-app notification for rejected report',
  );

  // Cannot re-verify or re-reject a rejected report
  const reRejectRes = await request(`/outage-reports/${report3.id}/reject`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${operatorToken}` },
    body: JSON.stringify({ reason: 'Duplicate rejection attempt.' }),
  });
  assert(reRejectRes.status === 400, 'Cannot reject an already rejected report (400 Bad Request)');

  // ==========================================
  // Test 4: Operator Verification & Unexpected Outage Creation
  // ==========================================
  console.log('\n--- 4. Operator Verification Workflow ---');
  const verifyRes = await request(`/outage-reports/${report1.id}/verify`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${operatorToken}` },
    body: JSON.stringify({
      title: 'Emergency: Transformer Explosion in Block C',
      estimatedRestoreTime: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
    }),
  });
  assert(verifyRes.status === 200, 'Operator verified Customer 1 report');
  const verifiedReport = verifyRes.body.data as {
    status: string;
    outageId: string;
    outage: { outageNumber: string; type: string; status: string };
  };
  assert(verifiedReport.status === 'VERIFIED', 'Report status transitioned to VERIFIED');
  assert(Boolean(verifiedReport.outageId), 'Unexpected outage created and linked');
  assert(verifiedReport.outage.type === 'UNEXPECTED', 'Linked outage type is UNEXPECTED');
  assert(verifiedReport.outage.status === 'ACTIVE', 'Linked outage initial status is ACTIVE');
  const createdOutageId = verifiedReport.outageId;

  // Customer 1 cannot modify or withdraw verified report
  const modifyVerified = await request(`/outage-reports/${report1.id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${customer1Token}` },
    body: JSON.stringify({ description: 'Attempting to change verified report' }),
  });
  assert(modifyVerified.status === 400, 'Customer cannot update verified report (400)');

  // ==========================================
  // Test 5: Technician Management CRUD & Guard
  // ==========================================
  console.log('\n--- 5. Technician Management CRUD & Guard ---');
  // List technicians
  const techListRes = await request('/technicians', {
    headers: { Authorization: `Bearer ${operatorToken}` },
  });
  assert(techListRes.status === 200, 'Operator listed technicians');

  // Customer cannot create technician
  const custCreateTech = await request('/technicians', {
    method: 'POST',
    headers: { Authorization: `Bearer ${customer1Token}` },
    body: JSON.stringify({
      name: 'Illegal Tech',
      phone: '+8801811223344',
      zoneId: targetZone.id,
    }),
  });
  assert(custCreateTech.status === 403, 'Customer blocked from creating technician (403)');

  // Admin creates two technicians
  const createTech1Res = await request('/technicians', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      name: `Field Tech Alpha ${ts}`,
      phone: '+8801811000001',
      specialization: 'High-Voltage Transformers',
      zoneId: targetZone.id,
    }),
  });
  assert(createTech1Res.status === 201, 'Admin created Technician 1');
  const tech1 = createTech1Res.body.data as { id: string; name: string; isAvailable: boolean };
  assert(tech1.isAvailable === true, 'Technician 1 isAvailable initialized to true');

  const createTech2Res = await request('/technicians', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      name: `Field Tech Beta ${ts}`,
      phone: '+8801811000002',
      specialization: 'Underground Feeders',
      zoneId: targetZone.id,
    }),
  });
  assert(createTech2Res.status === 201, 'Admin created Technician 2');
  const tech2 = createTech2Res.body.data as { id: string; name: string };

  // ==========================================
  // Test 6: Concurrency-Safe Technician Assignment
  // ==========================================
  console.log('\n--- 6. Concurrency-Safe Technician Assignment ---');
  const assignRes = await request(`/outages/${createdOutageId}/assign`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${operatorToken}` },
    body: JSON.stringify({
      technicianId: tech1.id,
      notes: 'Investigate damaged step-down transformer and replace blown fuses.',
    }),
  });
  assert(assignRes.status === 201, 'Operator assigned Technician 1 to outage');
  const assignment = assignRes.body.data as {
    status: string;
    technician: { name: string };
  };
  assert(assignment.status === 'ASSIGNED', 'Assignment status is ASSIGNED');

  // Verify Technician 1 is now marked unavailable
  const checkTech1 = await request(`/technicians/${tech1.id}`, {
    headers: { Authorization: `Bearer ${operatorToken}` },
  });
  assert(
    (checkTech1.body.data as { isAvailable: boolean }).isAvailable === false,
    'Technician 1 isAvailable is now false',
  );

  // Double-assignment guard: Cannot assign Technician 1 to another outage while busy
  const doubleAssignRes = await request(`/outages/${createdOutageId}/assign`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${operatorToken}` },
    body: JSON.stringify({
      technicianId: tech1.id,
      notes: 'Attempting conflicting assignment',
    }),
  });
  assert(
    doubleAssignRes.status === 409,
    'Double-assignment guard blocks assigning busy technician (409 Conflict)',
    doubleAssignRes.body,
  );

  // Soft-delete guard: Admin cannot delete a technician with active assignments
  const deleteBusyTech = await request(`/technicians/${tech1.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(
    deleteBusyTech.status === 400,
    'Technician soft-delete guard blocks deleting technician with active assignments (400)',
    deleteBusyTech.body,
  );

  // Check assignments list on outage
  const listAssignmentsRes = await request(`/outages/${createdOutageId}/assignments`, {
    headers: { Authorization: `Bearer ${operatorToken}` },
  });
  assert(listAssignmentsRes.status === 200, 'Retrieved assignments for outage');
  const assignmentsList = listAssignmentsRes.body.data as Array<{ technician: { name: string } }>;
  assert(assignmentsList.length >= 1, 'Assignments list contains assigned technician');

  // ==========================================
  // Test 7: Repair Progress Tracking & History Timeline
  // ==========================================
  console.log('\n--- 7. Repair Progress Tracking & History Timeline ---');
  const progressRes = await request(`/outages/${createdOutageId}/progress`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${operatorToken}` },
    body: JSON.stringify({
      repairNotes: 'Transformer coil replaced. Testing line insulation before energizing.',
    }),
  });
  assert(progressRes.status === 200, 'Operator logged repair progress update');

  // View outage history timeline
  const historyRes = await request(`/outages/${createdOutageId}/history`, {
    headers: { Authorization: `Bearer ${customer1Token}` },
  });
  assert(historyRes.status === 200, 'Outage history event timeline retrieved');
  const historyData = historyRes.body.data as {
    timeline: Array<{ action: string }>;
    assignments: Array<unknown>;
  };
  assert(
    historyData.timeline.some((e) => e.action === 'TECHNICIAN_ASSIGNED'),
    'History timeline includes TECHNICIAN_ASSIGNED',
  );
  assert(
    historyData.timeline.some((e) => e.action === 'REPAIR_PROGRESS_UPDATED'),
    'History timeline includes REPAIR_PROGRESS_UPDATED',
  );

  // ==========================================
  // Test 8: Full Restoration Workflow & Notifications
  // ==========================================
  console.log('\n--- 8. Full Restoration Workflow ---');
  const restoreRes = await request(`/outages/${createdOutageId}/restore`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${operatorToken}` },
    body: JSON.stringify({
      notes: 'Substation circuit breaker closed. Grid voltage stabilized at 230V.',
    }),
  });
  assert(restoreRes.status === 200, 'Operator restored outage');
  const restoreData = restoreRes.body.data as {
    outage: { status: string };
    freedTechniciansCount: number;
    resolvedReportsCount: number;
  };
  assert(restoreData.outage.status === 'RESTORED', 'Outage status transitioned to RESTORED');
  assert(restoreData.freedTechniciansCount >= 1, 'Assigned technician freed');
  assert(restoreData.resolvedReportsCount >= 1, 'Linked customer report marked RESOLVED');

  // Verify Technician 1 is now freed and available
  const recheckTech1 = await request(`/technicians/${tech1.id}`, {
    headers: { Authorization: `Bearer ${operatorToken}` },
  });
  assert(
    (recheckTech1.body.data as { isAvailable: boolean }).isAvailable === true,
    'Technician 1 isAvailable transitioned back to true (freed)',
  );

  // Verify Customer 1 Report is RESOLVED
  const recheckReport1 = await request(`/outage-reports/${report1.id}`, {
    headers: { Authorization: `Bearer ${customer1Token}` },
  });
  assert(
    (recheckReport1.body.data as { status: string }).status === 'RESOLVED',
    'Customer 1 outage report status transitioned to RESOLVED',
  );

  // Cannot restore an already restored outage
  const reRestoreRes = await request(`/outages/${createdOutageId}/restore`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${operatorToken}` },
    body: JSON.stringify({ notes: 'Attempting duplicate restoration' }),
  });
  assert(reRestoreRes.status === 400, 'Cannot restore already restored outage (400 Bad Request)');

  // ==========================================
  // Test 9: In-App Notifications API
  // ==========================================
  console.log('\n--- 9. In-App Notifications API ---');
  const cust1NotifsRes = await request('/notifications', {
    headers: { Authorization: `Bearer ${customer1Token}` },
  });
  assert(cust1NotifsRes.status === 200, 'Customer 1 fetched notifications');
  const cust1NotifsData = cust1NotifsRes.body.data as {
    notifications: Array<{ id: string; title: string; isRead: boolean }>;
    unreadCount: number;
  };
  assert(cust1NotifsData.unreadCount > 0, 'Customer 1 has unread notifications');
  assert(
    cust1NotifsData.notifications.some((n) => n.title.includes('Power Restored')),
    'Customer 1 received Power Restored notification',
  );

  // Mark single notification read
  const unreadNotif = cust1NotifsData.notifications.find((n) => !n.isRead);
  if (unreadNotif) {
    const markReadRes = await request(`/notifications/${unreadNotif.id}/read`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${customer1Token}` },
    });
    assert(markReadRes.status === 200, 'Marked single notification as read');
    assert(
      (markReadRes.body.data as { isRead: boolean }).isRead === true,
      'Notification isRead is now true',
    );
  }

  // Mark all notifications read
  const markAllRes = await request('/notifications/read-all', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${customer1Token}` },
  });
  assert(markAllRes.status === 200, 'Marked all notifications as read');

  // Verify unread count is now 0
  const verifyAllRead = await request('/notifications?isRead=false', {
    headers: { Authorization: `Bearer ${customer1Token}` },
  });
  assert(
    (verifyAllRead.body.data as { unreadCount: number }).unreadCount === 0,
    'Unread count is now 0',
  );

  // Clean up unused technician 2
  const deleteTech2 = await request(`/technicians/${tech2.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(deleteTech2.status === 200, 'Cleaned up Technician 2 with no assignments');

  // ==========================================
  // Summary
  // ==========================================
  console.log('\n========================================');
  console.log(`Phase 5 Verification Complete:`);
  console.log(`  Passed: ${passed}`);
  console.log(`  Failed: ${failed}`);
  console.log('========================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Unhandled error during tests:', err);
  process.exit(1);
});

/**
 * Comprehensive verification script testing the EXACT Swagger demonstration sequence
 * with real demo IDs: 'area-gulshan-2-c', 'tech-rahim-01', Admin, Operator, Customer
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';

async function testDemoFlow() {
  console.log(`\n🎬 TESTING COMPLETE SWAGGER DEMO SEQUENCE at ${BASE_URL}\n`);

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, details?: any) {
    if (condition) {
      console.log(`  ✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${testName}`);
      if (details) console.error('     Details:', JSON.stringify(details, null, 2));
      failed++;
    }
  }

  // 1. Health Check
  const healthRes = await fetch(`${BASE_URL}/api/v1/health`);
  const healthData = await healthRes.json();
  assert(healthRes.status === 200 && healthData.data?.status === 'ok', 'Step 1: GET /api/v1/health succeeds', healthData);

  // 2. Admin Login
  const adminLoginRes = await fetch(`${BASE_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@gridwatch.com', password: 'Admin123!Secure' }),
  });
  const adminLogin = await adminLoginRes.json();
  assert(adminLoginRes.status === 200 && adminLogin.data?.user?.role === 'ADMIN', 'Step 2: Admin login succeeds', adminLogin);
  const adminToken = adminLogin.data?.accessToken;

  // 3. Customer Login & RBAC 403 test
  const customerLoginRes = await fetch(`${BASE_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'customer@gridwatch.com', password: 'User123!Secure' }),
  });
  const customerLogin = await customerLoginRes.json();
  assert(customerLoginRes.status === 200 && customerLogin.data?.user?.role === 'CUSTOMER', 'Step 3a: Customer login succeeds', customerLogin);
  const customerToken = customerLogin.data?.accessToken;

  // Try creating zone as customer -> 403
  const forbiddenRes = await fetch(`${BASE_URL}/api/v1/zones`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerToken}` },
    body: JSON.stringify({ name: 'Unauthorized Zone', code: 'ZONE-UNAUTH-01' }),
  });
  const forbiddenData = await forbiddenRes.json();
  assert(forbiddenRes.status === 403, 'Step 3b: Customer blocked with 403 Forbidden on Admin route', forbiddenData);

  // 4. Operator Login
  const operatorLoginRes = await fetch(`${BASE_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'operator@gridwatch.com', password: 'User123!Secure' }),
  });
  const operatorLogin = await operatorLoginRes.json();
  assert(operatorLoginRes.status === 200 && operatorLogin.data?.user?.role === 'POWER_OPERATOR', 'Step 4a: Operator login succeeds', operatorLogin);
  const operatorToken = operatorLogin.data?.accessToken;

  // Schedule planned outage with demo areaId: 'area-gulshan-2-c'
  // Use unique future dates per test run to test schedule creation and conflict
  const randomDays = 300 + Math.floor(Math.random() * 10000);
  const futureStart = new Date(Date.now() + 1000 * 3600 * 24 * randomDays).toISOString();
  const futureEnd = new Date(Date.now() + 1000 * 3600 * 24 * randomDays + 1000 * 3600 * 4).toISOString();

  const scheduleOutageRes = await fetch(`${BASE_URL}/api/v1/outages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${operatorToken}` },
    body: JSON.stringify({
      title: 'Substation Routine Maintenance',
      description: 'Quarterly transformer bush replacement and line inspection',
      outageType: 'PLANNED',
      areaId: 'area-gulshan-2-c',
      startTime: futureStart,
      estimatedEndTime: futureEnd,
    }),
  });
  const scheduleData = await scheduleOutageRes.json();
  assert(
    scheduleOutageRes.status === 201 && scheduleData.data?.areaId === 'area-gulshan-2-c',
    "Step 4b: Operator schedules planned outage with areaId 'area-gulshan-2-c'",
    scheduleData
  );
  const scheduledOutageId = scheduleData.data?.id;

  // Repeat same schedule -> 409 Conflict
  const conflictRes = await fetch(`${BASE_URL}/api/v1/outages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${operatorToken}` },
    body: JSON.stringify({
      title: 'Conflicting Outage Test',
      outageType: 'PLANNED',
      areaId: 'area-gulshan-2-c',
      startTime: futureStart,
      estimatedEndTime: futureEnd,
    }),
  });
  const conflictData = await conflictRes.json();
  assert(conflictRes.status === 409, 'Step 4c: Scheduling overlapping outage returns 409 Conflict', conflictData);

  // 5. Customer Outage Report with 'area-gulshan-2-c'
  const reportRes = await fetch(`${BASE_URL}/api/v1/outage-reports`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerToken}` },
    body: JSON.stringify({
      title: `Blackout test ${Date.now()}`,
      description: 'Loud noise near Road 11 followed by complete power cutoff',
      areaId: 'area-gulshan-2-c',
      severity: 'HIGH',
    }),
  });
  const reportData = await reportRes.json();
  assert(
    reportRes.status === 201 && reportData.data?.status === 'PENDING',
    "Step 5: Customer submits outage report with areaId 'area-gulshan-2-c'",
    reportData
  );
  const reportId = reportData.data?.id;

  // 6. Operator Verifies Customer Report with notes
  const verifyRes = await fetch(`${BASE_URL}/api/v1/outage-reports/${reportId}/verify`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${operatorToken}` },
    body: JSON.stringify({
      notes: 'Verified feeder trip through grid SCADA telemetry.',
    }),
  });
  const verifyData = await verifyRes.json();
  assert(
    verifyRes.status === 200 && verifyData.data?.status === 'VERIFIED' && verifyData.data?.outageId,
    'Step 6: Operator verifies report with notes, auto-spawns active outage',
    verifyData
  );
  const activeOutageId = verifyData.data?.outageId;

  // 7. Operator Assigns Technician with demo ID 'tech-rahim-01'
  const assignRes = await fetch(`${BASE_URL}/api/v1/outages/${activeOutageId}/assign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${operatorToken}` },
    body: JSON.stringify({
      technicianId: 'tech-rahim-01',
      notes: 'Inspect secondary transformer breaker fuses',
    }),
  });
  const assignData = await assignRes.json();
  assert(
    assignRes.status === 201 && assignData.data?.technicianId === 'tech-rahim-01',
    "Step 7a: Operator assigns technician with technicianId 'tech-rahim-01'",
    assignData
  );

  // Operator logs repair progress with notes
  const progressRes = await fetch(`${BASE_URL}/api/v1/outages/${activeOutageId}/progress`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${operatorToken}` },
    body: JSON.stringify({
      notes: 'Replaced faulty porcelain insulator; commencing phase testing.',
    }),
  });
  const progressData = await progressRes.json();
  assert(progressRes.status === 200, 'Step 7b: Operator logs repair progress with notes', progressData);

  // Operator restores power with restorationNotes
  const restoreRes = await fetch(`${BASE_URL}/api/v1/outages/${activeOutageId}/restore`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${operatorToken}` },
    body: JSON.stringify({
      restorationNotes: 'Breaker replaced. Feeder re-energized. Voltage stable at 11kV.',
    }),
  });
  const restoreData = await restoreRes.json();
  assert(
    restoreRes.status === 200 && restoreData.data?.outage?.status === 'RESTORED',
    'Step 7c: Operator restores outage with restorationNotes',
    restoreData
  );

  // 8. Customer fetches In-App Notifications
  const notifRes = await fetch(`${BASE_URL}/api/v1/notifications`, {
    headers: { Authorization: `Bearer ${customerToken}` },
  });
  const notifData = await notifRes.json();
  assert(
    notifRes.status === 200 && Array.isArray(notifData.data?.notifications) && notifData.data.notifications.length > 0,
    'Step 8: Customer retrieves notifications for verified report & restoration',
    { count: notifData.data?.notifications?.length }
  );

  // 9. Premium Analytics & Stripe Checkout
  // Admin can access area analytics freely
  const adminAnalyticsRes = await fetch(`${BASE_URL}/api/v1/premium/area-analytics?areaId=area-gulshan-2-c`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const adminAnalyticsData = await adminAnalyticsRes.json();
  assert(
    adminAnalyticsRes.status === 200 && adminAnalyticsData.data?.area?.id === 'area-gulshan-2-c',
    "Step 9a: Admin retrieves Premium Area Analytics for 'area-gulshan-2-c'",
    adminAnalyticsData
  );

  // Customer Checkout Session creation
  const checkoutRes = await fetch(`${BASE_URL}/api/v1/payments/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerToken}` },
    body: JSON.stringify({ plan: 'MONTHLY_PRIORITY' }),
  });
  const checkoutData = await checkoutRes.json();
  assert(
    checkoutRes.status === 201 && checkoutData.data?.url?.includes('stripe.com'),
    'Step 9b: Customer initiates Stripe Checkout Session returning Stripe-hosted URL',
    checkoutData
  );

  // 10. Admin Stats & Audit Logs
  const statsRes = await fetch(`${BASE_URL}/api/v1/admin/stats`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const statsData = await statsRes.json();
  assert(statsRes.status === 200 && statsData.data?.users?.total >= 3, 'Step 10a: Admin gets platform system statistics', statsData);

  const auditRes = await fetch(`${BASE_URL}/api/v1/admin/audit-logs`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const auditData = await auditRes.json();
  assert(auditRes.status === 200 && Array.isArray(auditData.data), 'Step 10b: Admin queries immutable audit logs', auditData);

  console.log(`\n📊 Demo Sequence Test Complete: ${passed} Passed, ${failed} Failed\n`);
  if (failed > 0) process.exit(1);
}

testDemoFlow().catch((e) => {
  console.error('Fatal error in demo flow:', e);
  process.exit(1);
});

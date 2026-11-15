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
  console.log('🧪 Starting Phase 7 Validation & Security Verification Suite...\n');

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
  assert(custLogin.status === 200, 'Customer login succeeded');
  const customerToken = (custLogin.body.data as { accessToken: string }).accessToken;

  // ==========================================
  // Test 1: Admin Audit Logs & Search
  // ==========================================
  console.log('\n--- 1. Admin Audit Logs & Search ---');
  const customerAudit = await request('/admin/audit-logs', {
    headers: { Authorization: `Bearer ${customerToken}` },
  });
  assert(customerAudit.status === 403, 'Customer denied access to Admin audit logs (403 Forbidden)');

  const operatorAudit = await request('/admin/audit-logs', {
    headers: { Authorization: `Bearer ${operatorToken}` },
  });
  assert(operatorAudit.status === 403, 'Operator denied access to Admin audit logs (403 Forbidden)');

  const adminAudit = await request('/admin/audit-logs?page=1&limit=10', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(adminAudit.status === 200, 'Admin successfully retrieved audit logs (200 OK)');
  const auditData = adminAudit.body.data as Array<{ action: string; entity: string; user?: { email: string } }>;
  assert(Array.isArray(auditData), 'Audit logs data is an array');
  assert(auditData.length > 0, 'Audit logs contain recorded system activities');
  assert(Boolean(adminAudit.body.meta), 'Audit logs response includes pagination metadata');

  // Filter audit logs by action
  const filterAudit = await request('/admin/audit-logs?action=OUTAGE', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(filterAudit.status === 200, 'Filtered audit logs by action');

  // ==========================================
  // Test 2: Admin System Statistics
  // ==========================================
  console.log('\n--- 2. Admin System Statistics ---');
  const customerStats = await request('/admin/stats', {
    headers: { Authorization: `Bearer ${customerToken}` },
  });
  assert(customerStats.status === 403, 'Customer denied access to system stats (403)');

  const adminStats = await request('/admin/stats', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(adminStats.status === 200, 'Admin successfully retrieved system stats (200 OK)');
  const stats = adminStats.body.data as {
    users: { total: number; customers: number; operators: number; admins: number };
    network: { zones: number; substations: number; feeders: number; areas: number };
    outages: { total: number; active: number; planned: number; unexpected: number };
    finance: { totalRevenueUsd: number; activeSubscribers: number };
  };
  assert(stats.users.total >= 3, 'Stats report total users count >= 3');
  assert(stats.users.admins >= 1, 'Stats report at least 1 admin');
  assert(stats.network.zones >= 1, 'Stats report registered zones');
  assert(stats.network.areas >= 1, 'Stats report registered areas');
  assert(typeof stats.finance.totalRevenueUsd === 'number', 'Stats report financial metrics');

  // ==========================================
  // Test 3: Foreign Key & Relationship Integrity
  // ==========================================
  console.log('\n--- 3. Database Foreign Key & Relationship Integrity ---');
  // Attempt to create Substation with invalid non-existent zoneId
  const fakeUuid = '00000000-0000-0000-0000-000000000099';
  const badSubstation = await request('/substations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      name: 'Orphan Substation',
      code: `SUB-ORPHAN-${Date.now()}`,
      zoneId: fakeUuid,
    }),
  });
  assert(
    badSubstation.status === 400 || badSubstation.status === 404,
    'Substation referencing invalid zoneId rejected (400/404)',
  );

  // Attempt to create Feeder with invalid non-existent substationId
  const badFeeder = await request('/feeders', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      name: 'Orphan Feeder',
      code: `FDR-ORPHAN-${Date.now()}`,
      substationId: fakeUuid,
    }),
  });
  assert(
    badFeeder.status === 400 || badFeeder.status === 404,
    'Feeder referencing invalid substationId rejected (400/404)',
  );

  // Attempt to create Area with invalid non-existent feederId
  const badArea = await request('/areas', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      name: 'Orphan Area',
      feederId: fakeUuid,
    }),
  });
  assert(
    badArea.status === 400 || badArea.status === 404,
    'Area referencing invalid feederId rejected (400/404)',
  );

  // Attempt to create Outage with invalid non-existent areaId
  const badOutage = await request('/outages', {
    method: 'POST',
    headers: { Authorization: `Bearer ${operatorToken}` },
    body: JSON.stringify({
      title: 'Orphan Outage',
      areaId: fakeUuid,
      startTime: new Date().toISOString(),
      endTime: new Date(Date.now() + 3600000).toISOString(),
    }),
  });
  assert(
    badOutage.status === 400 || badOutage.status === 404,
    'Outage referencing invalid areaId rejected (400/404)',
  );

  // ==========================================
  // Test 4: Concurrency & Race Condition Verification
  // ==========================================
  console.log('\n--- 4. Concurrency & Race Condition Testing ---');
  // Get an existing valid area and zone
  const areasRes = await request('/areas?limit=1', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const targetArea = (areasRes.body.data as Array<{ id: string }>)[0];

  const zonesRes = await request('/zones?limit=1', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const targetZone = (zonesRes.body.data as Array<{ id: string }>)[0];

  // 4A: Concurrent Conflicting Outage Scheduling
  // Create an isolated area for concurrency testing
  const feedersRes = await request('/feeders?limit=1', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const firstFeeder = (feedersRes.body.data as Array<{ id: string }>)[0];

  const tempAreaRes = await request('/areas', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      name: `Concurrency Test Area ${Date.now()}`,
      feederId: firstFeeder.id,
    }),
  });
  assert(tempAreaRes.status === 201, 'Created isolated area for concurrency tests');
  const concAreaId = (tempAreaRes.body.data as { id: string }).id;

  // Send two simultaneous requests for overlapping time in the fresh area
  const startT = new Date(Date.now() + 50 * 3600000).toISOString();
  const endT = new Date(Date.now() + 52 * 3600000).toISOString();

  const [resA, resB] = await Promise.all([
    request('/outages', {
      method: 'POST',
      headers: { Authorization: `Bearer ${operatorToken}` },
      body: JSON.stringify({
        title: `Concurrent Schedule A ${Date.now()}`,
        areaId: concAreaId,
        startTime: startT,
        endTime: endT,
      }),
    }),
    request('/outages', {
      method: 'POST',
      headers: { Authorization: `Bearer ${operatorToken}` },
      body: JSON.stringify({
        title: `Concurrent Schedule B ${Date.now()}`,
        areaId: concAreaId,
        startTime: startT,
        endTime: endT,
      }),
    }),
  ]);

  // One must succeed (201) and the conflicting one must be rejected with 409 Conflict
  const oneSucceeded = (resA.status === 201 && resB.status === 409) || (resA.status === 409 && resB.status === 201);
  assert(oneSucceeded, 'Concurrent overlapping schedule race handled: exactly one succeeds (201), one rejected (409 Conflict)');

  // Clean up created outage
  const createdOutageId = resA.status === 201
    ? (resA.body.data as { id: string }).id
    : (resB.body.data as { id: string }).id;

  await request(`/outages/${createdOutageId}/cancel`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${operatorToken}` },
    body: JSON.stringify({ reason: 'Cleaning up concurrency test schedule' }),
  });

  // 4B: Concurrent Conflicting Technician Assignment
  // Register a dedicated test technician
  const newTech = await request('/technicians', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      name: `Race Condition Tech ${Date.now()}`,
      phone: '+8801999887766',
      zoneId: targetZone.id,
    }),
  });
  assert(newTech.status === 201, 'Created race condition test technician');
  const techId = (newTech.body.data as { id: string }).id;

  // Create two distinct non-overlapping active outages for race testing
  const [out1Res, out2Res] = await Promise.all([
    request('/outages', {
      method: 'POST',
      headers: { Authorization: `Bearer ${operatorToken}` },
      body: JSON.stringify({
        title: `Race Outage Incident 1 ${Date.now()}`,
        areaId: concAreaId,
        startTime: new Date(Date.now() + 200 * 3600000).toISOString(),
        endTime: new Date(Date.now() + 202 * 3600000).toISOString(),
      }),
    }),
    request('/outages', {
      method: 'POST',
      headers: { Authorization: `Bearer ${operatorToken}` },
      body: JSON.stringify({
        title: `Race Outage Incident 2 ${Date.now()}`,
        areaId: concAreaId,
        startTime: new Date(Date.now() + 210 * 3600000).toISOString(),
        endTime: new Date(Date.now() + 212 * 3600000).toISOString(),
      }),
    }),
  ]);

  if (out1Res.status !== 201) console.error('out1Res failed:', out1Res.status, out1Res.body);
  if (out2Res.status !== 201) console.error('out2Res failed:', out2Res.status, out2Res.body);

  assert(out1Res.status === 201, 'Created race test target Outage 1');
  assert(out2Res.status === 201, 'Created race test target Outage 2');

  const outage1Id = (out1Res.body.data as { id: string }).id;
  const outage2Id = (out2Res.body.data as { id: string }).id;

  if (outage1Id && outage2Id) {
    // Attempt concurrent assignment of the SAME technician to both outages simultaneously
    const [assignA, assignB] = await Promise.all([
      request(`/outages/${outage1Id}/assign`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${operatorToken}` },
        body: JSON.stringify({ technicianId: techId, notes: 'Assignment Race A' }),
      }),
      request(`/outages/${outage2Id}/assign`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${operatorToken}` },
        body: JSON.stringify({ technicianId: techId, notes: 'Assignment Race B' }),
      }),
    ]);

    const racePrevented =
      (assignA.status === 201 && assignB.status === 409) ||
      (assignA.status === 409 && assignB.status === 201);

    assert(
      racePrevented,
      'Concurrent double-assignment race handled: exactly one succeeds (201), other blocked (409 Conflict)',
    );

    // Clean up: restore outage to free technician
    const winningOutageId = assignA.status === 201 ? outage1Id : outage2Id;
    await request(`/outages/${winningOutageId}/restore`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${operatorToken}` },
      body: JSON.stringify({ notes: 'Concurrency test cleanup restoration' }),
    });
  }

  // Delete test technician
  await request(`/technicians/${techId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${adminToken}` },
  });

  // ==========================================
  // Test 5: Standard Response Format Integrity
  // ==========================================
  console.log('\n--- 5. Standardized Envelope Validation ---');
  const validProfile = await request('/users/me', {
    headers: { Authorization: `Bearer ${customerToken}` },
  });
  assert(
    validProfile.body.success === true && typeof validProfile.body.message === 'string' && validProfile.body.data !== undefined,
    'Success envelope conforms to { success: true, message: string, data: object }',
  );

  const errorResponse = await request('/areas/00000000-0000-0000-0000-000000000000', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(
    errorResponse.body.success === false && typeof errorResponse.body.message === 'string' && Array.isArray(errorResponse.body.errors),
    'Error envelope conforms to { success: false, message: string, errors: array }',
  );

  // ==========================================
  // Summary
  // ==========================================
  console.log('\n========================================');
  console.log(`Phase 7 Verification Complete:`);
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

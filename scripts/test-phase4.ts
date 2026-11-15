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
  console.log('🧪 Starting Phase 4 Automated Verification Suite...\n');

  // Step 0: Login as Admin, Operator, and Customer to get tokens
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
  const opToken = (opLogin.body.data as { accessToken: string }).accessToken;

  const custLogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'customer@gridwatch.com', password: 'User123!Secure' }),
  });
  assert(custLogin.status === 200, 'Customer login succeeded');
  const custToken = (custLogin.body.data as { accessToken: string }).accessToken;

  const timestamp = Date.now();

  // Step 1: Distribution Zone Tests
  console.log('\n--- 1. Zone Management Tests ---');
  const zoneCode = `ZONE-TEST-${timestamp}`;

  // 1.1 Customer attempts to create zone -> 403 Forbidden
  const custCreateZone = await request('/zones', {
    method: 'POST',
    headers: { Authorization: `Bearer ${custToken}` },
    body: JSON.stringify({ name: 'Cust Zone', code: 'ZONE-CUST' }),
  });
  assert(custCreateZone.status === 403, 'Customer denied creating zone (403 Forbidden)');

  // 1.2 Operator attempts to create zone -> 403 Forbidden
  const opCreateZone = await request('/zones', {
    method: 'POST',
    headers: { Authorization: `Bearer ${opToken}` },
    body: JSON.stringify({ name: 'Op Zone', code: 'ZONE-OP' }),
  });
  assert(opCreateZone.status === 403, 'Operator denied creating zone (403 Forbidden)');

  // 1.3 Admin creates zone -> 201 Created
  const adminCreateZone = await request('/zones', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      name: `Test Distribution Zone ${timestamp}`,
      code: zoneCode,
      description: 'Automated test distribution zone',
    }),
  });
  assert(adminCreateZone.status === 201, 'Admin created zone (201 Created)');
  const createdZone = adminCreateZone.body.data as { id: string; name: string; code: string };
  assert(createdZone.code === zoneCode, 'Zone code matches');

  // 1.4 Duplicate zone code -> 409 Conflict
  const dupZone = await request('/zones', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ name: 'Duplicate Zone', code: zoneCode }),
  });
  assert(dupZone.status === 409, 'Duplicate zone code returns 409 Conflict');

  // 1.5 List zones -> 200 OK
  const listZones = await request('/zones?page=1&limit=5', { method: 'GET' });
  assert(listZones.status === 200, 'List zones returns 200 OK');
  assert(Array.isArray(listZones.body.data), 'Zones list is an array');
  assert(Boolean(listZones.body.meta), 'Zones list contains pagination meta');

  // 1.6 Get single zone -> 200 OK
  const getZone = await request(`/zones/${createdZone.id}`, { method: 'GET' });
  assert(getZone.status === 200, 'Get single zone returns 200 OK');
  assert((getZone.body.data as { id: string }).id === createdZone.id, 'Retrieved zone ID matches');

  // 1.7 Update zone -> 200 OK
  const updateZone = await request(`/zones/${createdZone.id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ description: 'Updated test description' }),
  });
  assert(updateZone.status === 200, 'Update zone returns 200 OK');

  // Step 2: Substation Management Tests
  console.log('\n--- 2. Substation Management Tests ---');
  const subCode = `SUB-TEST-${timestamp}`;

  // 2.1 Admin creates substation -> 201 Created
  const adminCreateSub = await request('/substations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      name: `Test Substation ${timestamp}`,
      code: subCode,
      zoneId: createdZone.id,
      capacityKva: 50000,
    }),
  });
  assert(adminCreateSub.status === 201, 'Admin created substation (201 Created)');
  const createdSub = adminCreateSub.body.data as { id: string; name: string; code: string };

  // 2.2 Invalid zone ID -> 400 Bad Request
  const invZoneSub = await request('/substations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      name: 'Bad Zone Sub',
      code: `SUB-BAD-${timestamp}`,
      zoneId: '00000000-0000-0000-0000-000000000000',
    }),
  });
  assert(invZoneSub.status === 400, 'Invalid zone ID returns 400 Bad Request');

  // 2.3 List substations filtered by zone -> 200 OK
  const listSubs = await request(`/substations?zoneId=${createdZone.id}`, { method: 'GET' });
  assert(listSubs.status === 200, 'List substations filtered by zone returns 200 OK');

  // Step 3: Feeder Management Tests
  console.log('\n--- 3. Feeder Management Tests ---');
  const feederCode = `FDR-TEST-${timestamp}`;

  // 3.1 Admin creates feeder -> 201 Created
  const adminCreateFeeder = await request('/feeders', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      name: `Test Feeder ${timestamp}`,
      code: feederCode,
      substationId: createdSub.id,
      maxLoadKw: 10000,
    }),
  });
  assert(adminCreateFeeder.status === 201, 'Admin created feeder (201 Created)');
  const createdFeeder = adminCreateFeeder.body.data as { id: string; name: string; code: string };

  // Step 4: Area Management Tests
  console.log('\n--- 4. Area Management Tests ---');
  // 4.1 Admin creates area -> 201 Created
  const adminCreateArea = await request('/areas', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      name: `Test Area Alpha ${timestamp}`,
      postalCode: '1215',
      feederId: createdFeeder.id,
    }),
  });
  assert(adminCreateArea.status === 201, 'Admin created area (201 Created)');
  const createdArea = adminCreateArea.body.data as { id: string; name: string };

  // 4.2 Create second area for cross-area tests
  const adminCreateArea2 = await request('/areas', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      name: `Test Area Beta ${timestamp}`,
      postalCode: '1216',
      feederId: createdFeeder.id,
    }),
  });
  const createdArea2 = adminCreateArea2.body.data as { id: string; name: string };

  // 4.3 Search areas -> 200 OK
  const searchArea = await request(`/areas?search=Alpha`, { method: 'GET' });
  assert(searchArea.status === 200, 'Search areas by name returns 200 OK');

  // Step 5: Safe Deletion Dependency Checks
  console.log('\n--- 5. Safe Deletion Dependency Checks ---');
  // 5.1 Deleting zone with active substations must fail -> 400 Bad Request
  const deleteZoneFail = await request(`/zones/${createdZone.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(deleteZoneFail.status === 400, 'Prevented deleting zone with active substations (400 Bad Request)');

  // 5.2 Deleting substation with active feeders must fail -> 400 Bad Request
  const deleteSubFail = await request(`/substations/${createdSub.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(deleteSubFail.status === 400, 'Prevented deleting substation with active feeders (400 Bad Request)');

  // 5.3 Deleting feeder with active areas must fail -> 400 Bad Request
  const deleteFeederFail = await request(`/feeders/${createdFeeder.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(deleteFeederFail.status === 400, 'Prevented deleting feeder with active areas (400 Bad Request)');

  // Step 6: Planned Load-Shedding & Outage Management Tests
  console.log('\n--- 6. Planned Outage Scheduling & Conflict Validation ---');
  const now = new Date();
  const slot1Start = new Date(now.getTime() + 10 * 3600 * 1000); // 10 hours from now
  const slot1End = new Date(now.getTime() + 12 * 3600 * 1000);   // 12 hours from now

  // 6.1 Customer attempts to create outage -> 403 Forbidden
  const custCreateOutage = await request('/outages', {
    method: 'POST',
    headers: { Authorization: `Bearer ${custToken}` },
    body: JSON.stringify({
      title: 'Customer Outage',
      areaId: createdArea.id,
      startTime: slot1Start.toISOString(),
      endTime: slot1End.toISOString(),
    }),
  });
  assert(custCreateOutage.status === 403, 'Customer denied creating outage schedule (403 Forbidden)');

  // 6.2 Invalid time interval (endTime before startTime) -> 400 Bad Request
  const invTimeOutage = await request('/outages', {
    method: 'POST',
    headers: { Authorization: `Bearer ${opToken}` },
    body: JSON.stringify({
      title: 'Invalid Times Outage',
      areaId: createdArea.id,
      startTime: slot1End.toISOString(),
      endTime: slot1Start.toISOString(),
    }),
  });
  assert(invTimeOutage.status === 400, 'Invalid time range (end < start) returns 400 Bad Request');

  // 6.3 Operator creates planned schedule (Slot 1: 10:00 - 12:00) -> 201 Created
  const opCreateOutage1 = await request('/outages', {
    method: 'POST',
    headers: { Authorization: `Bearer ${opToken}` },
    body: JSON.stringify({
      title: `Scheduled Maintenance A ${timestamp}`,
      description: 'Feeder maintenance and load shedding',
      areaId: createdArea.id,
      startTime: slot1Start.toISOString(),
      endTime: slot1End.toISOString(),
    }),
  });
  assert(opCreateOutage1.status === 201, 'Operator created planned outage (201 Created)');
  const outage1 = opCreateOutage1.body.data as { id: string; outageNumber: string; status: string };
  assert(Boolean(outage1.outageNumber), 'Generated unique outageNumber');
  assert(outage1.status === 'PUBLISHED', 'Initial status is PUBLISHED');

  // 6.4 CONFLICT DETECTION: Overlapping schedule for same area (11:00 - 13:00 overlaps 10:00 - 12:00) -> 409 Conflict
  const conflictStart = new Date(now.getTime() + 11 * 3600 * 1000);
  const conflictEnd = new Date(now.getTime() + 13 * 3600 * 1000);
  const conflictOutage = await request('/outages', {
    method: 'POST',
    headers: { Authorization: `Bearer ${opToken}` },
    body: JSON.stringify({
      title: 'Conflicting Schedule',
      areaId: createdArea.id,
      startTime: conflictStart.toISOString(),
      endTime: conflictEnd.toISOString(),
    }),
  });
  assert(conflictOutage.status === 409, 'Schedule Conflict Detection: Overlapping outage rejected with 409 Conflict');

  // 6.5 NON-CONFLICTING SCHEDULE: Overlapping time but DIFFERENT area -> 201 Created
  const diffAreaOutage = await request('/outages', {
    method: 'POST',
    headers: { Authorization: `Bearer ${opToken}` },
    body: JSON.stringify({
      title: 'Different Area Outage',
      areaId: createdArea2.id,
      startTime: conflictStart.toISOString(),
      endTime: conflictEnd.toISOString(),
    }),
  });
  assert(diffAreaOutage.status === 201, 'Same time window for different area allowed (201 Created)');

  // 6.6 List outages with filtering & search
  const listOutages = await request(`/outages?areaId=${createdArea.id}&page=1&limit=5`, { method: 'GET' });
  assert(listOutages.status === 200, 'List outages by area returns 200 OK');
  assert(Array.isArray(listOutages.body.data), 'Outages response is an array');

  // 6.7 Get single outage details
  const getOutage = await request(`/outages/${outage1.id}`, { method: 'GET' });
  assert(getOutage.status === 200, 'Get single outage details returns 200 OK');
  assert((getOutage.body.data as { id: string }).id === outage1.id, 'Outage ID matches');

  // 6.8 Operator updates outage title
  const updateOutage = await request(`/outages/${outage1.id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${opToken}` },
    body: JSON.stringify({ title: `Updated Maintenance A ${timestamp}` }),
  });
  assert(updateOutage.status === 200, 'Update outage details returns 200 OK');

  // 6.9 Operator cancels outage schedule -> 200 OK
  const cancelOutage = await request(`/outages/${outage1.id}/cancel`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${opToken}` },
    body: JSON.stringify({ reason: 'Grid load normalized, maintenance postponed' }),
  });
  assert(cancelOutage.status === 200, 'Cancel outage schedule returns 200 OK');
  assert((cancelOutage.body.data as { status: string }).status === 'CANCELLED', 'Outage status updated to CANCELLED');

  // 6.10 Schedule in previously cancelled slot is now allowed (cancelled schedule does not cause conflict) -> 201 Created
  const reuseSlot = await request('/outages', {
    method: 'POST',
    headers: { Authorization: `Bearer ${opToken}` },
    body: JSON.stringify({
      title: 'Slot Reused Outage',
      areaId: createdArea.id,
      startTime: slot1Start.toISOString(),
      endTime: slot1End.toISOString(),
    }),
  });
  assert(reuseSlot.status === 201, 'Scheduling in previously cancelled slot succeeds without conflict (201 Created)');
  const outageToDel = (reuseSlot.body.data as { id: string }).id;

  // 6.11 Soft-delete outage -> 200 OK
  const deleteOutage = await request(`/outages/${outageToDel}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${opToken}` },
  });
  assert(deleteOutage.status === 200, 'Soft-delete outage returns 200 OK');

  // 6.12 Deleted outage returns 404
  const getDeletedOutage = await request(`/outages/${outageToDel}`, { method: 'GET' });
  assert(getDeletedOutage.status === 404, 'Soft-deleted outage excluded from queries (404 Not Found)');

  console.log(`\n========================================`);
  console.log(`🎉 PHASE 4 TEST SUMMARY: ${passed} PASSED | ${failed} FAILED`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

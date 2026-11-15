const BASE_URL = 'http://localhost:5000/api/v1';

interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data: T;
  errors?: unknown[];
  meta?: unknown;
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
  console.log('🧪 Starting Phase 3 Automated Verification Suite...\n');

  // Test 1: Health Check with live DB query
  console.log('--- 1. Health & DB Check ---');
  const healthRes = await request('/health', { method: 'GET' });
  assert(healthRes.status === 200, 'Health check returns 200 OK');
  assert(healthRes.body.success === true, 'Health response success envelope is true');
  assert((healthRes.body.data as { database?: string })?.database === 'connected', 'Database is connected to Neon');

  // Test 2: Registration
  console.log('\n--- 2. Registration Tests ---');
  const timestamp = Date.now();
  const testEmail = `test_customer_${timestamp}@gridwatch.com`;

  // 2.1 Successful Customer Registration
  const regRes = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Test Customer',
      email: testEmail,
      password: 'SecurePassword123!',
      phone: '+8801799999999',
      role: 'ADMIN', // Injection attempt! Must be ignored and set to CUSTOMER
    }),
  });
  assert(regRes.status === 201, 'Registration returns 201 Created');
  assert(regRes.body.success === true, 'Registration success is true');
  const regUser = (regRes.body.data as { user: { role: string; email: string }; accessToken: string; refreshToken: string })?.user;
  assert(regUser?.role === 'CUSTOMER', 'Role injection blocked: user role is strictly CUSTOMER');
  assert(regUser?.email === testEmail, 'User email matches registered email');
  assert(Boolean((regRes.body.data as { accessToken?: string })?.accessToken), 'Access token issued');
  assert(Boolean((regRes.body.data as { refreshToken?: string })?.refreshToken), 'Refresh token issued');

  // 2.2 Duplicate Email
  const dupRes = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Duplicate Customer',
      email: testEmail,
      password: 'SecurePassword123!',
    }),
  });
  assert(dupRes.status === 409, 'Duplicate email returns 409 Conflict');
  assert(dupRes.body.success === false, 'Duplicate email success is false');

  // 2.3 Invalid Email Format
  const invEmailRes = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Invalid Email',
      email: 'not-an-email',
      password: 'SecurePassword123!',
    }),
  });
  assert(invEmailRes.status === 400, 'Invalid email returns 400 Bad Request');

  // 2.4 Weak / Short Password
  const weakPassRes = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Weak Pass',
      email: `weak_${timestamp}@gridwatch.com`,
      password: '123',
    }),
  });
  assert(weakPassRes.status === 400, 'Weak password returns 400 Bad Request');

  // Test 3: Login
  console.log('\n--- 3. Login Tests ---');
  // 3.1 Correct Credentials
  const loginRes = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: testEmail,
      password: 'SecurePassword123!',
    }),
  });
  assert(loginRes.status === 200, 'Valid login returns 200 OK');
  assert(loginRes.body.success === true, 'Valid login success is true');
  let customerAccessToken = (loginRes.body.data as { accessToken: string })?.accessToken;
  let customerRefreshToken = (loginRes.body.data as { refreshToken: string })?.refreshToken;
  assert(Boolean(customerAccessToken), 'Login issued access token');
  assert(Boolean(customerRefreshToken), 'Login issued refresh token');

  // 3.2 Wrong Password
  const wrongPassRes = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: testEmail,
      password: 'WrongPassword!',
    }),
  });
  assert(wrongPassRes.status === 400, 'Wrong password returns 400 Bad Request');

  // 3.3 Unknown Email
  const unknownEmailRes = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: `nonexistent_${timestamp}@gridwatch.com`,
      password: 'SecurePassword123!',
    }),
  });
  assert(unknownEmailRes.status === 400, 'Unknown email returns 400 Bad Request');

  // Test 4: Refresh Token & Rotation
  console.log('\n--- 4. Refresh Token & Rotation Tests ---');
  const refreshRes = await request('/auth/refresh-token', {
    method: 'POST',
    body: JSON.stringify({ refreshToken: customerRefreshToken }),
  });
  assert(refreshRes.status === 200, 'Valid refresh token returns 200 OK');
  const newAccessToken = (refreshRes.body.data as { accessToken: string })?.accessToken;
  const newRefreshToken = (refreshRes.body.data as { refreshToken: string })?.refreshToken;
  assert(Boolean(newAccessToken), 'New access token issued');
  assert(Boolean(newRefreshToken) && newRefreshToken !== customerRefreshToken, 'Refresh token was rotated securely');

  // 4.1 Token Reuse (replay attack detection)
  const reusedTokenRes = await request('/auth/refresh-token', {
    method: 'POST',
    body: JSON.stringify({ refreshToken: customerRefreshToken }),
  });
  assert(reusedTokenRes.status === 401, 'Reusing rotated refresh token is rejected with 401 Unauthorized');

  // Update customer tokens for next tests
  customerAccessToken = newAccessToken;
  customerRefreshToken = newRefreshToken;

  // Test 5: User Profile (`/users/me`)
  console.log('\n--- 5. User Profile Tests ---');
  // 5.1 Missing Bearer Token
  const noTokenRes = await request('/users/me', { method: 'GET' });
  assert(noTokenRes.status === 401, 'Access without token returns 401 Unauthorized');

  // 5.2 Invalid Bearer Token
  const invTokenRes = await request('/users/me', {
    method: 'GET',
    headers: { Authorization: 'Bearer this.is.an.invalid.token' },
  });
  assert(invTokenRes.status === 401, 'Access with invalid token returns 401 Unauthorized');

  // 5.3 Valid Token Get Profile
  const myProfileRes = await request('/users/me', {
    method: 'GET',
    headers: { Authorization: `Bearer ${customerAccessToken}` },
  });
  assert(myProfileRes.status === 200, 'Get profile returns 200 OK');
  assert((myProfileRes.body.data as { email?: string })?.email === testEmail, 'Profile email matches');

  // 5.4 Update Profile (permitted fields: name, phone)
  const updateProfileRes = await request('/users/me', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${customerAccessToken}` },
    body: JSON.stringify({
      name: 'Updated Test Customer',
      phone: '+8801788888888',
      role: 'ADMIN', // Unauthorized role escalation attempt
    }),
  });
  assert(updateProfileRes.status === 200, 'Update profile returns 200 OK');
  const updatedUser = updateProfileRes.body.data as { name: string; phone: string; role: string };
  assert(updatedUser.name === 'Updated Test Customer', 'Name was updated');
  assert(updatedUser.phone === '+8801788888888', 'Phone was updated');
  assert(updatedUser.role === 'CUSTOMER', 'Role escalation blocked: role remains CUSTOMER');

  // Test 6: RBAC (Role-Based Access Control)
  console.log('\n--- 6. Role-Based Access Control (RBAC) Tests ---');
  // 6.1 Customer attempts Admin-only route
  const custToAdminRes = await request('/admin/users', {
    method: 'GET',
    headers: { Authorization: `Bearer ${customerAccessToken}` },
  });
  assert(custToAdminRes.status === 403, 'Customer denied access to Admin route (403 Forbidden)');

  // 6.2 Login as Operator (seeded operator)
  const opLoginRes = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: 'operator@gridwatch.com',
      password: 'User123!Secure',
    }),
  });
  assert(opLoginRes.status === 200, 'Operator login successful (200 OK)');
  const opAccessToken = (opLoginRes.body.data as { accessToken: string })?.accessToken;

  // 6.3 Operator attempts Admin-only route
  const opToAdminRes = await request('/admin/users', {
    method: 'GET',
    headers: { Authorization: `Bearer ${opAccessToken}` },
  });
  assert(opToAdminRes.status === 403, 'Operator denied access to Admin route (403 Forbidden)');

  // 6.4 Login as Admin (seeded admin)
  const adminLoginRes = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: 'admin@gridwatch.com',
      password: 'Admin123!Secure',
    }),
  });
  assert(adminLoginRes.status === 200, 'Admin login successful (200 OK)');
  const adminAccessToken = (adminLoginRes.body.data as { accessToken: string })?.accessToken;

  // 6.5 Admin accesses Admin-only route
  const adminGetUsersRes = await request('/admin/users?page=1&limit=10', {
    method: 'GET',
    headers: { Authorization: `Bearer ${adminAccessToken}` },
  });
  assert(adminGetUsersRes.status === 200, 'Admin successfully accesses Admin route (200 OK)');
  assert(Array.isArray(adminGetUsersRes.body.data), 'Admin list users data is an array');
  assert(Boolean(adminGetUsersRes.body.meta), 'Admin list users includes pagination metadata');

  // Test 7: Admin User Management Operations
  console.log('\n--- 7. Admin User Management & Audit Tests ---');
  // 7.1 Promote customer to POWER_OPERATOR
  const targetCustId = (regRes.body.data as { user: { id: string } }).user.id;
  const promoteRes = await request(`/admin/users/${targetCustId}/role`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${adminAccessToken}` },
    body: JSON.stringify({ role: 'POWER_OPERATOR' }),
  });
  assert(promoteRes.status === 200, 'Admin promoted customer to POWER_OPERATOR (200 OK)');
  assert((promoteRes.body.data as { role: string })?.role === 'POWER_OPERATOR', 'Role updated in DB to POWER_OPERATOR');

  // 7.2 Safety guard: Admin cannot demote last active Admin
  const adminUser = (adminLoginRes.body.data as { user: { id: string } }).user;
  const demoteAdminRes = await request(`/admin/users/${adminUser.id}/role`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${adminAccessToken}` },
    body: JSON.stringify({ role: 'CUSTOMER' }),
  });
  assert(demoteAdminRes.status === 400, 'Safety Guard: Prevented demoting last active Admin (400 Bad Request)');

  // 7.3 Safety guard: Admin cannot suspend their own account
  const suspendSelfRes = await request(`/admin/users/${adminUser.id}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${adminAccessToken}` },
    body: JSON.stringify({ isActive: false }),
  });
  assert(suspendSelfRes.status === 400, 'Safety Guard: Prevented Admin from suspending self (400 Bad Request)');

  // 7.4 Admin suspends target user
  const suspendTargetRes = await request(`/admin/users/${targetCustId}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${adminAccessToken}` },
    body: JSON.stringify({ isActive: false }),
  });
  assert(suspendTargetRes.status === 200, 'Admin suspended target user account (200 OK)');

  // 7.5 Suspended user attempts login -> rejected with 403
  const suspendedLoginRes = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: testEmail,
      password: 'SecurePassword123!',
    }),
  });
  assert(suspendedLoginRes.status === 403, 'Suspended user login rejected with 403 Forbidden');

  // 7.6 Reactivate target user
  await request(`/admin/users/${targetCustId}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${adminAccessToken}` },
    body: JSON.stringify({ isActive: true }),
  });

  // Test 8: Logout
  console.log('\n--- 8. Logout Tests ---');
  const logoutRes = await request('/auth/logout', {
    method: 'POST',
    body: JSON.stringify({ refreshToken: customerRefreshToken }),
  });
  assert(logoutRes.status === 200, 'Logout returns 200 OK');

  // Attempt refresh after logout
  const postLogoutRefresh = await request('/auth/refresh-token', {
    method: 'POST',
    body: JSON.stringify({ refreshToken: customerRefreshToken }),
  });
  assert(postLogoutRefresh.status === 401, 'Logged out refresh token cannot be used (401 Unauthorized)');

  // Test 9: Google OAuth Endpoint validation
  console.log('\n--- 9. Google OAuth Endpoint Tests ---');
  const gMissingRes = await request('/auth/google', {
    method: 'POST',
    body: JSON.stringify({}),
  });
  assert(gMissingRes.status === 400, 'Missing Google ID token rejected with 400 Bad Request');

  const gInvalidRes = await request('/auth/google', {
    method: 'POST',
    body: JSON.stringify({ idToken: 'fake_google_token_123456789' }),
  });
  assert(gInvalidRes.status === 400, 'Invalid Google ID token rejected with 400 Bad Request');

  console.log(`\n========================================`);
  console.log(`🎉 TEST SUMMARY: ${passed} PASSED | ${failed} FAILED`);
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

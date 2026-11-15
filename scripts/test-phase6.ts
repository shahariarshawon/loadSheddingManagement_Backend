import crypto from 'crypto';

const BASE_URL = 'http://localhost:5000/api/v1';
const WEBHOOK_SECRET =
  process.env.STRIPE_WEBHOOK_SECRET || 'whsec_fyAjHykads83QfUIW8iUmEJUFcumjGAIv';

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

function generateStripeSignature(payload: string, secret: string) {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${payload}`, 'utf8')
    .digest('hex');
  return `t=${timestamp},v1=${signature}`;
}

async function runTests() {
  console.log('🧪 Starting Phase 6 Automated Verification Suite: Stripe Payments & Premium Feature...\n');

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

  const cust1Login = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'customer@gridwatch.com', password: 'User123!Secure' }),
  });
  assert(cust1Login.status === 200, 'Customer 1 login succeeded');
  const customer1Token = (cust1Login.body.data as { accessToken: string }).accessToken;

  // Register Customer 3 (Non-paying fresh user)
  const ts = Date.now();
  const cust3Email = `cust3_${ts}@gridwatch.com`;
  const cust3Reg = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Customer Three Premium Prospect',
      email: cust3Email,
      password: 'Password123!',
      phone: '+8801700777666',
    }),
  });
  assert(cust3Reg.status === 201, 'Customer 3 registration succeeded');
  const customer3Token = (cust3Reg.body.data as { accessToken: string }).accessToken;

  // Get a target Area for analytics
  const areasRes = await request('/areas?limit=1', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(areasRes.status === 200, 'Areas fetched');
  const targetArea = (areasRes.body.data as Array<{ id: string; name: string }>)[0];

  // ==========================================
  // Test 1: Premium Gate Check Before Payment
  // ==========================================
  console.log('\n--- 1. Premium Access Gate (Pre-Payment) ---');
  const preStatusRes = await request('/premium/status', {
    headers: { Authorization: `Bearer ${customer3Token}` },
  });
  assert(preStatusRes.status === 200, 'Customer 3 retrieved subscription status');
  const preStatus = preStatusRes.body.data as { hasActivePremium: boolean };
  assert(preStatus.hasActivePremium === false, 'Customer 3 hasActivePremium is false');

  const preAnalyticsRes = await request(`/premium/area-analytics?areaId=${targetArea.id}`, {
    headers: { Authorization: `Bearer ${customer3Token}` },
  });
  assert(
    preAnalyticsRes.status === 403,
    'Unpaid Customer 3 denied access to Premium Area Analytics (403 Forbidden)',
    preAnalyticsRes.body,
  );

  // ==========================================
  // Test 2: Stripe Checkout Session Creation
  // ==========================================
  console.log('\n--- 2. Stripe Checkout Session Creation ---');
  // Unauthenticated checkout request blocked
  const unauthCheckout = await request('/payments/checkout', {
    method: 'POST',
    body: JSON.stringify({ plan: 'MONTHLY_PRIORITY' }),
  });
  assert(unauthCheckout.status === 401, 'Unauthenticated checkout request rejected (401)');

  // Customer 3 initiates real Stripe Checkout
  const checkoutRes = await request('/payments/checkout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${customer3Token}` },
    body: JSON.stringify({ plan: 'MONTHLY_PRIORITY' }),
  });
  assert(checkoutRes.status === 201, 'Stripe Checkout Session created (201 Created)');
  const checkoutData = checkoutRes.body.data as {
    paymentId: string;
    checkoutUrl: string;
    sessionId: string;
    amount: number;
    currency: string;
    plan: string;
  };
  assert(Boolean(checkoutData.paymentId), 'Internal payment record created');
  assert(Boolean(checkoutData.sessionId), 'Stripe session ID returned');
  assert(
    checkoutData.checkoutUrl.startsWith('https://checkout.stripe.com/'),
    'Genuine Stripe-hosted Checkout URL returned',
  );
  assert(checkoutData.amount === 10, 'Server-controlled amount is $10.00 USD');
  assert(checkoutData.plan === 'MONTHLY_PRIORITY', 'Plan is MONTHLY_PRIORITY');

  // ==========================================
  // Test 3: Payment Tracking & Authorization
  // ==========================================
  console.log('\n--- 3. Payment Tracking & RBAC ---');
  // Customer 3 views own payment history
  const myPaymentsRes = await request('/payments/my', {
    headers: { Authorization: `Bearer ${customer3Token}` },
  });
  assert(myPaymentsRes.status === 200, 'Customer 3 retrieved own payment history');
  const myPayments = myPaymentsRes.body.data as Array<{ id: string; status: string }>;
  assert(
    myPayments.some((p) => p.id === checkoutData.paymentId && p.status === 'PENDING'),
    'Pending payment record found in payment history',
  );

  // Customer 3 checks payment status by session ID
  const sessionStatusRes = await request(`/payments/status/${checkoutData.sessionId}`, {
    headers: { Authorization: `Bearer ${customer3Token}` },
  });
  assert(sessionStatusRes.status === 200, 'Payment status lookup by session ID returns 200');
  assert(
    (sessionStatusRes.body.data as { status: string }).status === 'PENDING',
    'Payment status is PENDING before webhook',
  );

  // Customer 1 cannot view Customer 3's payment -> 403 Forbidden
  const cust1ViewCust3Payment = await request(`/payments/${checkoutData.paymentId}`, {
    headers: { Authorization: `Bearer ${customer1Token}` },
  });
  assert(
    cust1ViewCust3Payment.status === 403,
    'Customer 1 denied viewing Customer 3 payment (403 Forbidden)',
  );

  // Operator cannot access platform financial records -> 403 Forbidden
  const operatorViewPayments = await request('/payments', {
    headers: { Authorization: `Bearer ${operatorToken}` },
  });
  assert(
    operatorViewPayments.status === 403,
    'Operator denied access to platform payments list (403 Forbidden)',
  );

  // Admin views platform payments -> 200 OK
  const adminViewPayments = await request('/payments', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(adminViewPayments.status === 200, 'Admin successfully listed all platform payments');

  // ==========================================
  // Test 4: Webhook Security & Signature Verification
  // ==========================================
  console.log('\n--- 4. Webhook Security & Signature Verification ---');
  const dummyPayload = JSON.stringify({ id: 'evt_dummy', type: 'dummy' });

  // Missing signature header -> 400 Bad Request
  const noSigRes = await fetch(`${BASE_URL}/payments/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: dummyPayload,
  });
  assert(noSigRes.status === 400, 'Webhook without stripe-signature rejected (400 Bad Request)');

  // Forged / Invalid signature -> 400 Bad Request
  const badSigRes = await fetch(`${BASE_URL}/payments/webhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'stripe-signature': 't=1234567890,v1=bad_forged_signature_1234567890abcdef',
    },
    body: dummyPayload,
  });
  assert(
    badSigRes.status === 400,
    'Webhook with invalid signature rejected (400 Bad Request)',
  );

  // ==========================================
  // Test 5: Webhook Fulfillment & Activation
  // ==========================================
  console.log('\n--- 5. Webhook Fulfillment & Premium Activation ---');
  const eventId = `evt_test_${Date.now()}`;
  const webhookEventPayload = JSON.stringify({
    id: eventId,
    object: 'event',
    api_version: '2025-02-24.acacia',
    created: Math.floor(Date.now() / 1000),
    type: 'checkout.session.completed',
    data: {
      object: {
        id: checkoutData.sessionId,
        object: 'checkout.session',
        payment_status: 'paid',
        payment_intent: `pi_test_${Date.now()}`,
        amount_total: 1000,
        currency: 'usd',
        client_reference_id: (cust3Reg.body.data as { user: { id: string } }).user?.id,
        customer_email: cust3Email,
      },
    },
  });

  const validSignature = generateStripeSignature(webhookEventPayload, WEBHOOK_SECRET);

  const webhookDeliveryRes = await fetch(`${BASE_URL}/payments/webhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'stripe-signature': validSignature,
    },
    body: webhookEventPayload,
  });

  assert(webhookDeliveryRes.status === 200, 'Valid Stripe webhook accepted (200 OK)');
  const webhookResBody = (await webhookDeliveryRes.json()) as { received: boolean };
  assert(webhookResBody.received === true, 'Webhook response received is true');

  // Verify Payment status is now SUCCEEDED
  const verifyPaymentRes = await request(`/payments/status/${checkoutData.sessionId}`, {
    headers: { Authorization: `Bearer ${customer3Token}` },
  });
  assert(verifyPaymentRes.status === 200, 'Fetched updated payment status');
  const updatedPayment = verifyPaymentRes.body.data as {
    status: string;
    subscriptionId: string;
    paidAt: string | null;
  };
  assert(updatedPayment.status === 'SUCCEEDED', 'Payment status transitioned to SUCCEEDED');
  assert(Boolean(updatedPayment.paidAt), 'Payment paidAt timestamp recorded');
  assert(Boolean(updatedPayment.subscriptionId), 'Payment linked to active subscription');

  // Customer 3 received In-App Notification of activation
  const cust3Notifs = await request('/notifications', {
    headers: { Authorization: `Bearer ${customer3Token}` },
  });
  assert(cust3Notifs.status === 200, 'Customer 3 notifications fetched');
  const notifItems = (cust3Notifs.body.data as { notifications: Array<{ title: string }> })
    .notifications;
  assert(
    notifItems.some((n) => n.title.includes('Premium Pass Activated')),
    'Customer 3 received In-App Notification confirming activation',
  );

  // ==========================================
  // Test 6: Idempotency & Duplicate Webhook Replay Guard
  // ==========================================
  console.log('\n--- 6. Idempotency & Duplicate Event Replay Guard ---');
  const duplicateWebhookRes = await fetch(`${BASE_URL}/payments/webhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'stripe-signature': validSignature,
    },
    body: webhookEventPayload,
  });

  assert(duplicateWebhookRes.status === 200, 'Duplicate webhook returns 200 to Stripe');
  const dupResBody = (await duplicateWebhookRes.json()) as {
    received: boolean;
    duplicate?: boolean;
  };
  assert(dupResBody.duplicate === true, 'Duplicate webhook event detected and safely skipped');

  // ==========================================
  // Test 7: Premium Access Gate (Post-Payment) & Real Analytics
  // ==========================================
  console.log('\n--- 7. Premium Analytics Access (Post-Payment) ---');
  const postStatusRes = await request('/premium/status', {
    headers: { Authorization: `Bearer ${customer3Token}` },
  });
  assert(postStatusRes.status === 200, 'Customer 3 rechecked subscription status');
  const postStatus = postStatusRes.body.data as {
    hasActivePremium: boolean;
    daysRemaining: number;
    subscription: { plan: string };
  };
  assert(postStatus.hasActivePremium === true, 'Customer 3 hasActivePremium is now true');
  assert(postStatus.daysRemaining >= 29, 'Customer 3 daysRemaining is ~30 days');

  // Now Customer 3 can access the premium analytics!
  const postAnalyticsRes = await request(`/premium/area-analytics?areaId=${targetArea.id}`, {
    headers: { Authorization: `Bearer ${customer3Token}` },
  });
  assert(postAnalyticsRes.status === 200, 'Customer 3 successfully retrieved Area Analytics (200 OK)');
  const analyticsData = postAnalyticsRes.body.data as {
    area: { name: string };
    reliabilitySummary: { availabilityPercentage: number; reliabilityRating: string };
    outageStatistics: { totalOutages: number; plannedOutages: number; unexpectedOutages: number };
    durationMetrics: { totalRecordedDowntimeMinutes: number; averageOutageDurationMinutes: number };
  };

  assert(Boolean(analyticsData.area.name), 'Analytics includes verified target area details');
  assert(
    typeof analyticsData.reliabilitySummary.availabilityPercentage === 'number',
    'Analytics includes calculated availability percentage',
  );
  assert(
    Boolean(analyticsData.reliabilitySummary.reliabilityRating),
    'Analytics includes reliability rating (e.g. EXCELLENT / GOOD)',
  );
  assert(
    typeof analyticsData.outageStatistics.totalOutages === 'number',
    'Analytics includes real total outages count from DB',
  );
  assert(
    typeof analyticsData.durationMetrics.totalRecordedDowntimeMinutes === 'number',
    'Analytics includes real calculated downtime minutes',
  );

  // ==========================================
  // Test 8: Success & Cancel Redirect Endpoints
  // ==========================================
  console.log('\n--- 8. Informational Redirects ---');
  const successRedirect = await request(`/payments/success?session_id=${checkoutData.sessionId}`);
  assert(successRedirect.status === 200, 'Success redirect endpoint returns 200 OK');

  const cancelRedirect = await request('/payments/cancel');
  assert(cancelRedirect.status === 200, 'Cancel redirect endpoint returns 200 OK');

  // ==========================================
  // Summary
  // ==========================================
  console.log('\n========================================');
  console.log(`Phase 6 Verification Complete:`);
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

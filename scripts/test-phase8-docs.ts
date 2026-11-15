/**
 * Phase 8 Swagger & Production Readiness Verification Script
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';

async function runVerification() {
  console.log(`\n🔍 Verifying Swagger UI & OpenAPI Specification at: ${BASE_URL}`);

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, details?: any) {
    if (condition) {
      console.log(`  ✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${testName}`);
      if (details) console.error('     Details:', details);
      failed++;
    }
  }

  try {
    // 1. Root route
    const rootRes = await fetch(`${BASE_URL}/`);
    const rootJson = await rootRes.json();
    assert(
      rootRes.status === 200 &&
      rootJson.data?.documentation === '/api-docs' &&
      rootJson.data?.openApiSpec === '/api-docs.json',
      'GET / returns metadata with /api-docs and /api-docs.json',
      rootJson
    );

    // 2. Health check
    const healthRes = await fetch(`${BASE_URL}/api/v1/health`);
    const healthJson = await healthRes.json();
    assert(
      healthRes.status === 200 &&
      healthJson.data?.status === 'ok' &&
      healthJson.data?.database === 'connected',
      'GET /api/v1/health confirms server and Neon PostgreSQL connectivity',
      healthJson
    );

    // 3. OpenAPI JSON Spec
    const specRes = await fetch(`${BASE_URL}/api-docs.json`);
    const specJson = await specRes.json();
    assert(
      specRes.status === 200 &&
      specJson.openapi === '3.0.3' &&
      specJson.info?.title.includes('GridWatch') &&
      Object.keys(specJson.paths || {}).length >= 20,
      `GET /api-docs.json serves valid OpenAPI 3.0.3 specification with ${Object.keys(specJson.paths || {}).length} documented paths (>= 20)`,
      { openapi: specJson.openapi, pathCount: Object.keys(specJson.paths || {}).length }
    );

    // 4. Swagger UI HTML
    const uiRes = await fetch(`${BASE_URL}/api-docs/`);
    const uiHtml = await uiRes.text();
    assert(
      uiRes.status === 200 &&
      uiHtml.includes('swagger-ui') &&
      uiHtml.includes('swagger-ui-init.js'),
      'GET /api-docs/ serves Swagger UI interactive HTML interface'
    );

    // 5. Backward compatibility redirect /api/v1/docs -> /api-docs
    const redirectRes = await fetch(`${BASE_URL}/api/v1/docs`, { redirect: 'manual' });
    assert(
      redirectRes.status === 302 &&
      redirectRes.headers.get('location') === '/api-docs',
      'GET /api/v1/docs redirects (302) to /api-docs'
    );

    // 6. Security Scheme Check in OpenAPI
    assert(
      specJson.components?.securitySchemes?.bearerAuth?.type === 'http' &&
      specJson.components?.securitySchemes?.bearerAuth?.scheme === 'bearer',
      'OpenAPI specification defines JWT bearerAuth security scheme'
    );

    // 7. Verify All Three Roles and Operations in Endpoints
    const paths = specJson.paths;
    assert(
      paths['/api/v1/auth/login'] &&
      paths['/api/v1/auth/register'] &&
      paths['/api/v1/users/me'] &&
      paths['/api/v1/outages'] &&
      paths['/api/v1/outage-reports'] &&
      paths['/api/v1/technicians'] &&
      paths['/api/v1/payments/checkout'] &&
      paths['/api/v1/payments/webhook'] &&
      paths['/api/v1/premium/area-analytics'] &&
      paths['/api/v1/admin/users'] &&
      paths['/api/v1/admin/stats'],
      'All major domain modules and role workflows are mapped in Swagger'
    );

    console.log(`\n📊 Phase 8 Verification Results: ${passed} Passed, ${failed} Failed\n`);
    if (failed > 0) process.exit(1);
  } catch (err) {
    console.error('Fatal verification error:', err);
    process.exit(1);
  }
}

runVerification();

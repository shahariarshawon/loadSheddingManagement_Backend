/**
 * GridWatch OpenAPI 3.0.3 Specification
 * Load Shedding & Power Outage Management System REST API
 * Programming Hero B7A6 Assignment 6
 */

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'GridWatch API — Load Shedding & Power Outage Management System',
    version: '1.0.0',
    description: `
**GridWatch** is a production-grade backend REST API for intelligent load shedding management, power outage scheduling, automated customer incident reporting, technician field assignment, and Stripe-powered premium reliability analytics.

### Authentication & Authorization
- **Bearer Token**: All protected endpoints require an \`Authorization: Bearer <token>\` header.
- **Three Core Roles**:
  - \`CUSTOMER\`: Submit outage reports, view public outage schedules, receive in-app notifications, purchase premium subscriptions via Stripe, and inspect reliability metrics.
  - \`POWER_OPERATOR\`: Manage grid network infrastructure, schedule and update load-shedding outages, verify and resolve customer reports, assign technicians, and log power restorations.
  - \`ADMIN\`: Full supervisory control over user accounts, roles, soft-deletion, immutable audit log analysis, and system-wide monitoring metrics.

### Environments
- **Production Base URL**: \`https://loadsheddingmanagement-backend.onrender.com\`
- **Local Development**: \`http://localhost:5000\`
    `,
    contact: {
      name: 'Shahariar Shawon',
      url: 'https://github.com/shahariarshawon/loadSheddingManagement_Backend',
    },
  },
  servers: [
    {
      url: 'https://loadsheddingmanagement-backend.onrender.com',
      description: 'Render Production Environment',
    },
    {
      url: 'http://localhost:5000',
      description: 'Local Development Server',
    },
  ],
  tags: [
    { name: 'System & Health', description: 'System health, database connectivity checks, and API discovery' },
    { name: 'Authentication & OAuth', description: 'JWT registration, email/password login, Google OAuth, token refresh, and logout' },
    { name: 'User Profile', description: 'Authenticated user profile retrieval and updates' },
    { name: 'Distribution Network - Zones', description: 'Geographic electrical zones (Admin managed, public read)' },
    { name: 'Distribution Network - Substations', description: 'High-voltage grid substations (Admin managed, public read)' },
    { name: 'Distribution Network - Feeders', description: 'Distribution feeder lines (Admin managed, public read)' },
    { name: 'Distribution Network - Areas', description: 'Local consumer power areas and sectors (Admin managed, public read)' },
    { name: 'Planned Outages & Schedules', description: 'Load shedding schedule planning, conflict detection, updates, cancellations, and restoration' },
    { name: 'Customer Outage Reports', description: 'Crowdsourced outage reporting, customer history, operator verification, and rejection' },
    { name: 'Technician Operations', description: 'Technician dispatch, work order status tracking, and field restoration logs' },
    { name: 'In-App Notifications', description: 'Real-time and persistent alerts for outage events and verification updates' },
    { name: 'Stripe Payments & Checkout', description: 'Stripe Checkout session creation, payment status tracking, and customer billing history' },
    { name: 'Stripe Webhooks', description: 'Cryptographically signed Stripe webhook event receiver and automated fulfillment' },
    { name: 'Premium Services & Analytics', description: 'Subscription entitlement verification and AI-assisted area reliability score analytics' },
    { name: 'Admin User Management', description: 'Supervisory role assignment, account status management, and soft deletion' },
    { name: 'Admin System Monitoring & Audit Logs', description: 'System-wide metrics aggregations and immutable audit trail exploration' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Provide your JWT access token. Format: `Bearer <accessToken>`',
      },
    },
    schemas: {
      StandardSuccessResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string', example: 'Operation completed successfully' },
          data: { type: 'object' },
        },
        required: ['success', 'message', 'data'],
      },
      StandardErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          message: { type: 'string', example: 'Invalid input or resource not found' },
          errors: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                field: { type: 'string', example: 'email' },
                message: { type: 'string', example: 'Invalid email address format' },
              },
            },
          },
        },
        required: ['success', 'message', 'errors'],
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid', example: 'b8aa1c30-3026-42a4-bbcc-5dfda44f1b74' },
          name: { type: 'string', example: 'Tariq Rahman' },
          email: { type: 'string', format: 'email', example: 'customer@gridwatch.com' },
          phone: { type: 'string', example: '+8801900000001' },
          role: { type: 'string', enum: ['CUSTOMER', 'POWER_OPERATOR', 'ADMIN'], example: 'CUSTOMER' },
          isActive: { type: 'boolean', example: true },
          areaId: { type: 'string', nullable: true, example: 'area-gulshan-2-c' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      Zone: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'cm1234567890' },
          name: { type: 'string', example: 'Dhaka North Distribution Zone' },
          code: { type: 'string', example: 'ZONE-DHAKA-NORTH' },
          description: { type: 'string', example: 'North electricity supply grid covering Gulshan, Banani, and Mirpur.' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      Substation: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'cm2345678901' },
          name: { type: 'string', example: 'Gulshan 132/33kV Grid Substation' },
          code: { type: 'string', example: 'SUB-GULSHAN-01' },
          zoneId: { type: 'string', example: 'cm1234567890' },
          capacityKva: { type: 'number', example: 100000 },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      Feeder: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'cm3456789012' },
          name: { type: 'string', example: 'Gulshan Residential Feeder 01' },
          code: { type: 'string', example: 'FDR-GUL-RES-01' },
          substationId: { type: 'string', example: 'cm2345678901' },
          maxLoadKw: { type: 'number', example: 15000 },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      Area: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'area-gulshan-2-c' },
          name: { type: 'string', example: 'Gulshan-2 Sector C' },
          postalCode: { type: 'string', example: '1212' },
          feederId: { type: 'string', example: 'cm3456789012' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      Outage: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid', example: '9a5c9f52-850d-444a-921d-93ffc61cfb38' },
          title: { type: 'string', example: 'Scheduled Grid Maintenance' },
          description: { type: 'string', example: 'Substation feeder routine breaker inspection and cable testing.' },
          outageType: { type: 'string', enum: ['PLANNED', 'EMERGENCY', 'UNPLANNED'], example: 'PLANNED' },
          status: { type: 'string', enum: ['SCHEDULED', 'IN_PROGRESS', 'RESOLVED', 'CANCELLED'], example: 'SCHEDULED' },
          areaId: { type: 'string', example: 'area-gulshan-2-c' },
          createdById: { type: 'string', example: 'user-operator-id' },
          startTime: { type: 'string', format: 'date-time', example: '2026-11-20T10:00:00.000Z' },
          estimatedEndTime: { type: 'string', format: 'date-time', example: '2026-11-20T14:00:00.000Z' },
          actualEndTime: { type: 'string', format: 'date-time', nullable: true },
          restorationNotes: { type: 'string', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      OutageReport: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          title: { type: 'string', example: 'Transformer sparking near Road 11' },
          description: { type: 'string', example: 'Loud popping noise followed by sudden blackout on Block D.' },
          areaId: { type: 'string', example: 'area-gulshan-2-c' },
          customerId: { type: 'string', example: 'user-customer-id' },
          status: { type: 'string', enum: ['PENDING', 'VERIFIED', 'RESOLVED', 'REJECTED'], example: 'PENDING' },
          severity: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], example: 'HIGH' },
          verifiedById: { type: 'string', nullable: true },
          verifiedAt: { type: 'string', format: 'date-time', nullable: true },
          rejectionReason: { type: 'string', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      Technician: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'tech-rahim-01' },
          name: { type: 'string', example: 'Rahim Uddin' },
          phone: { type: 'string', example: '+8801711111111' },
          specialization: { type: 'string', example: 'High-Voltage Line & Transformer Repair' },
          zoneId: { type: 'string', example: 'cm1234567890' },
          isAvailable: { type: 'boolean', example: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      Notification: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          userId: { type: 'string' },
          title: { type: 'string', example: 'Outage Schedule Update' },
          message: { type: 'string', example: 'A planned outage has been scheduled for your area on Nov 20.' },
          type: { type: 'string', enum: ['OUTAGE_SCHEDULED', 'OUTAGE_CANCELLED', 'OUTAGE_RESTORED', 'REPORT_VERIFIED', 'REPORT_REJECTED', 'PAYMENT_SUCCESS'], example: 'OUTAGE_SCHEDULED' },
          isRead: { type: 'boolean', example: false },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Payment: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          userId: { type: 'string' },
          stripeSessionId: { type: 'string', example: 'cs_test_a1b2c3d4' },
          stripePaymentIntentId: { type: 'string', nullable: true, example: 'pi_test_12345' },
          amountCents: { type: 'integer', example: 1500 },
          currency: { type: 'string', example: 'usd' },
          status: { type: 'string', enum: ['PENDING', 'SUCCEEDED', 'FAILED', 'CANCELLED'], example: 'SUCCEEDED' },
          paidAt: { type: 'string', format: 'date-time', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  },
  paths: {
    // -------------------------------------------------------------
    // SYSTEM & HEALTH
    // -------------------------------------------------------------
    '/': {
      get: {
        tags: ['System & Health'],
        summary: 'Root Welcome & API Discovery',
        description: 'Returns API metadata, active version, documentation endpoint, and health check route.',
        responses: {
          200: {
            description: 'API information response',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/StandardSuccessResponse' },
                example: {
                  success: true,
                  message: 'GridWatch API - Load Shedding & Power Outage Management System',
                  data: { version: 'v1', documentation: '/api-docs', health: '/api/v1/health' },
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/health': {
      get: {
        tags: ['System & Health'],
        summary: 'System Health & Neon Database Connectivity Check',
        description: 'Performs a live database query (`SELECT 1`) to ensure Neon PostgreSQL and the API server are operational.',
        responses: {
          200: {
            description: 'Health status successful',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/StandardSuccessResponse' },
                example: {
                  success: true,
                  message: 'Server is running',
                  data: {
                    status: 'ok',
                    database: 'connected',
                    service: 'GridWatch API',
                    timestamp: '2026-11-15T09:50:57.917Z',
                    uptime: 1245.52,
                  },
                },
              },
            },
          },
        },
      },
    },

    // -------------------------------------------------------------
    // AUTHENTICATION & OAUTH
    // -------------------------------------------------------------
    '/api/v1/auth/register': {
      post: {
        tags: ['Authentication & OAuth'],
        summary: 'Customer Registration',
        description: 'Registers a new citizen customer account. Customers can optionally link their local power distribution area.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'email', 'password'],
                properties: {
                  name: { type: 'string', example: 'Tariq Rahman' },
                  email: { type: 'string', format: 'email', example: 'tariq@example.com' },
                  password: { type: 'string', minLength: 8, example: 'Pass123!Secure' },
                  phone: { type: 'string', example: '+8801911223344' },
                  areaId: { type: 'string', example: 'area-gulshan-2-c' },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Customer registered successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/StandardSuccessResponse' },
              },
            },
          },
          400: { description: 'Validation failed or email already registered' },
        },
      },
    },
    '/api/v1/auth/login': {
      post: {
        tags: ['Authentication & OAuth'],
        summary: 'Email & Password Login',
        description: 'Authenticates a user and returns a signed JWT access token (15-minute validity) and a refresh token (7-day validity).',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email', example: 'admin@gridwatch.com' },
                  password: { type: 'string', example: 'Admin123!Secure' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Login successful',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/StandardSuccessResponse' },
                example: {
                  success: true,
                  message: 'Login successful',
                  data: {
                    user: {
                      id: 'b8aa1c30-3026-42a4-bbcc-5dfda44f1b74',
                      name: 'System Administrator',
                      email: 'admin@gridwatch.com',
                      role: 'ADMIN',
                    },
                    accessToken: 'eyJhbGciOiJIUzI1Ni...',
                    refreshToken: 'eyJhbGciOiJIUzI1Ni...',
                  },
                },
              },
            },
          },
          401: { description: 'Invalid credentials or inactive account' },
        },
      },
    },
    '/api/v1/auth/google': {
      post: {
        tags: ['Authentication & OAuth'],
        summary: 'Google OAuth 2.0 Sign-In',
        description: 'Verifies a Google ID token from GCP OAuth and finds or creates a user account.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['idToken'],
                properties: {
                  idToken: { type: 'string', example: 'eyJhbGciOiJSUzI1NiIsImtpZCI6Ij...' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Google authentication successful' },
          400: { description: 'Invalid or expired Google ID token' },
        },
      },
    },
    '/api/v1/auth/refresh-token': {
      post: {
        tags: ['Authentication & OAuth'],
        summary: 'Refresh Access Token',
        description: 'Rotates and issues a new JWT access token using a valid, non-revoked refresh token.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['refreshToken'],
                properties: {
                  refreshToken: { type: 'string', example: 'eyJhbGciOiJIUzI1Ni...' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Tokens rotated successfully' },
          401: { description: 'Invalid, revoked or expired refresh token' },
        },
      },
    },
    '/api/v1/auth/logout': {
      post: {
        tags: ['Authentication & OAuth'],
        summary: 'User Logout',
        description: 'Revokes the provided refresh token and invalidates active session state.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['refreshToken'],
                properties: {
                  refreshToken: { type: 'string', example: 'eyJhbGciOiJIUzI1Ni...' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Successfully logged out' },
        },
      },
    },

    // -------------------------------------------------------------
    // USER PROFILE
    // -------------------------------------------------------------
    '/api/v1/users/me': {
      get: {
        tags: ['User Profile'],
        summary: 'Get Current Authenticated User Profile',
        security: [{ bearerAuth: [] }],
        description: 'Retrieves profile information for the authenticated user (accessible by CUSTOMER, POWER_OPERATOR, ADMIN).',
        responses: {
          200: {
            description: 'Profile retrieved successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/StandardSuccessResponse' },
              },
            },
          },
          401: { description: 'Unauthorized — valid JWT required' },
        },
      },
      patch: {
        tags: ['User Profile'],
        summary: 'Update Current User Profile',
        security: [{ bearerAuth: [] }],
        description: 'Updates personal profile attributes such as display name, contact phone, or assigned power area.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string', example: 'Tariq Rahman Updated' },
                  phone: { type: 'string', example: '+8801999887766' },
                  areaId: { type: 'string', example: 'area-banani-r11' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Profile updated successfully' },
          400: { description: 'Validation error' },
          401: { description: 'Unauthorized' },
        },
      },
    },

    // -------------------------------------------------------------
    // DISTRIBUTION NETWORK - ZONES
    // -------------------------------------------------------------
    '/api/v1/zones': {
      get: {
        tags: ['Distribution Network - Zones'],
        summary: 'List Distribution Zones',
        description: 'Lists all regional distribution zones with optional name search and pagination (Public read).',
        parameters: [
          { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Search by zone name or code' },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
        ],
        responses: { 200: { description: 'Zones retrieved successfully' } },
      },
      post: {
        tags: ['Distribution Network - Zones'],
        summary: 'Create Distribution Zone',
        security: [{ bearerAuth: [] }],
        description: 'Creates a new distribution zone. **Strictly ADMIN role required**.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'code'],
                properties: {
                  name: { type: 'string', example: 'Chittagong Central Distribution Zone' },
                  code: { type: 'string', example: 'ZONE-CTG-CENTRAL' },
                  description: { type: 'string', example: 'Port city central transmission grid.' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Zone created successfully' },
          403: { description: 'Forbidden — ADMIN role required' },
        },
      },
    },
    '/api/v1/zones/{id}': {
      get: {
        tags: ['Distribution Network - Zones'],
        summary: 'Get Distribution Zone Details',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Zone details with connected substations' }, 404: { description: 'Zone not found' } },
      },
      patch: {
        tags: ['Distribution Network - Zones'],
        summary: 'Update Distribution Zone',
        security: [{ bearerAuth: [] }],
        description: 'Updates zone name, code, or description. **Strictly ADMIN role required**.',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  description: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Zone updated successfully' }, 403: { description: 'Forbidden' } },
      },
      delete: {
        tags: ['Distribution Network - Zones'],
        summary: 'Delete Distribution Zone',
        security: [{ bearerAuth: [] }],
        description: 'Deletes a zone. Fails if dependent substations exist. **Strictly ADMIN role required**.',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Zone deleted successfully' }, 403: { description: 'Forbidden' } },
      },
    },

    // -------------------------------------------------------------
    // DISTRIBUTION NETWORK - SUBSTATIONS
    // -------------------------------------------------------------
    '/api/v1/substations': {
      get: {
        tags: ['Distribution Network - Substations'],
        summary: 'List Substations',
        description: 'Lists all grid substations, filterable by zoneId and search term.',
        parameters: [
          { name: 'zoneId', in: 'query', schema: { type: 'string' } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
        ],
        responses: { 200: { description: 'Substations retrieved successfully' } },
      },
      post: {
        tags: ['Distribution Network - Substations'],
        summary: 'Create Substation',
        security: [{ bearerAuth: [] }],
        description: 'Creates a substation under a zone. **Strictly ADMIN role required**.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'code', 'zoneId', 'capacityKva'],
                properties: {
                  name: { type: 'string', example: 'Uttara 132/33kV Substation' },
                  code: { type: 'string', example: 'SUB-UTTARA-01' },
                  zoneId: { type: 'string', example: 'cm1234567890' },
                  capacityKva: { type: 'number', example: 120000 },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Substation created successfully' }, 403: { description: 'Forbidden' } },
      },
    },
    '/api/v1/substations/{id}': {
      get: {
        tags: ['Distribution Network - Substations'],
        summary: 'Get Substation Details',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Substation details' }, 404: { description: 'Not found' } },
      },
      patch: {
        tags: ['Distribution Network - Substations'],
        summary: 'Update Substation',
        security: [{ bearerAuth: [] }],
        description: 'Updates substation name, capacity, or zone. **Strictly ADMIN role required**.',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  capacityKva: { type: 'number' },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Substation updated successfully' }, 403: { description: 'Forbidden' } },
      },
      delete: {
        tags: ['Distribution Network - Substations'],
        summary: 'Delete Substation',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Substation deleted' }, 403: { description: 'Forbidden' } },
      },
    },

    // -------------------------------------------------------------
    // DISTRIBUTION NETWORK - FEEDERS
    // -------------------------------------------------------------
    '/api/v1/feeders': {
      get: {
        tags: ['Distribution Network - Feeders'],
        summary: 'List Feeders',
        description: 'Lists distribution feeders, filterable by substationId.',
        parameters: [{ name: 'substationId', in: 'query', schema: { type: 'string' } }],
        responses: { 200: { description: 'Feeders retrieved successfully' } },
      },
      post: {
        tags: ['Distribution Network - Feeders'],
        summary: 'Create Feeder Line',
        security: [{ bearerAuth: [] }],
        description: 'Creates a distribution feeder line under a substation. **Strictly ADMIN role required**.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'code', 'substationId', 'maxLoadKw'],
                properties: {
                  name: { type: 'string', example: 'Uttara Sector 3 Feeder 01' },
                  code: { type: 'string', example: 'FDR-UTT-SEC3-01' },
                  substationId: { type: 'string', example: 'cm2345678901' },
                  maxLoadKw: { type: 'number', example: 14000 },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Feeder created successfully' }, 403: { description: 'Forbidden' } },
      },
    },
    '/api/v1/feeders/{id}': {
      get: {
        tags: ['Distribution Network - Feeders'],
        summary: 'Get Feeder Details',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Feeder details' }, 404: { description: 'Not found' } },
      },
      patch: {
        tags: ['Distribution Network - Feeders'],
        summary: 'Update Feeder',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  maxLoadKw: { type: 'number' },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Feeder updated' }, 403: { description: 'Forbidden' } },
      },
      delete: {
        tags: ['Distribution Network - Feeders'],
        summary: 'Delete Feeder',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Feeder deleted' }, 403: { description: 'Forbidden' } },
      },
    },

    // -------------------------------------------------------------
    // DISTRIBUTION NETWORK - AREAS
    // -------------------------------------------------------------
    '/api/v1/areas': {
      get: {
        tags: ['Distribution Network - Areas'],
        summary: 'List Distribution Areas',
        description: 'Lists power consumer areas and sectors, filterable by feederId or postal code (Public read).',
        parameters: [
          { name: 'feederId', in: 'query', schema: { type: 'string' } },
          { name: 'postalCode', in: 'query', schema: { type: 'string' } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
        ],
        responses: { 200: { description: 'Areas retrieved successfully' } },
      },
      post: {
        tags: ['Distribution Network - Areas'],
        summary: 'Create Area',
        security: [{ bearerAuth: [] }],
        description: 'Creates a local consumer power area linked to a feeder. **Strictly ADMIN role required**.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'postalCode', 'feederId'],
                properties: {
                  id: { type: 'string', example: 'area-uttara-sec3' },
                  name: { type: 'string', example: 'Uttara Sector 3 Residential' },
                  postalCode: { type: 'string', example: '1230' },
                  feederId: { type: 'string', example: 'cm3456789012' },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Area created successfully' }, 403: { description: 'Forbidden' } },
      },
    },
    '/api/v1/areas/{id}': {
      get: {
        tags: ['Distribution Network - Areas'],
        summary: 'Get Area Details',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Area details' }, 404: { description: 'Area not found' } },
      },
      patch: {
        tags: ['Distribution Network - Areas'],
        summary: 'Update Area',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  postalCode: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Area updated' }, 403: { description: 'Forbidden' } },
      },
      delete: {
        tags: ['Distribution Network - Areas'],
        summary: 'Delete Area',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Area deleted' }, 403: { description: 'Forbidden' } },
      },
    },

    // -------------------------------------------------------------
    // PLANNED OUTAGES & SCHEDULES
    // -------------------------------------------------------------
    '/api/v1/outages': {
      get: {
        tags: ['Planned Outages & Schedules'],
        summary: 'List Outages',
        description: 'Lists outages with filters for areaId, status, outageType, and date range. Public customers see active and scheduled outages; operators and admins see all.',
        parameters: [
          { name: 'areaId', in: 'query', schema: { type: 'string' } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['SCHEDULED', 'IN_PROGRESS', 'RESOLVED', 'CANCELLED'] } },
          { name: 'outageType', in: 'query', schema: { type: 'string', enum: ['PLANNED', 'EMERGENCY', 'UNPLANNED'] } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
        ],
        responses: { 200: { description: 'Outages retrieved successfully' } },
      },
      post: {
        tags: ['Planned Outages & Schedules'],
        summary: 'Schedule a Planned Outage',
        security: [{ bearerAuth: [] }],
        description: 'Schedules a new outage. **Uses PostgreSQL transaction advisory locks to guarantee no overlapping outage schedules on the same area.** Allowed roles: `POWER_OPERATOR`, `ADMIN`.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['title', 'areaId', 'startTime', 'estimatedEndTime'],
                properties: {
                  title: { type: 'string', example: 'Winter Feeder Overhaul' },
                  description: { type: 'string', example: 'Preventative transformer breaker servicing.' },
                  outageType: { type: 'string', enum: ['PLANNED', 'EMERGENCY', 'UNPLANNED'], default: 'PLANNED' },
                  areaId: { type: 'string', example: 'area-gulshan-2-c' },
                  startTime: { type: 'string', format: 'date-time', example: '2026-12-01T08:00:00.000Z' },
                  estimatedEndTime: { type: 'string', format: 'date-time', example: '2026-12-01T12:00:00.000Z' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Outage scheduled successfully and in-app notifications dispatched' },
          400: { description: 'Validation error or invalid time range' },
          409: { description: 'Conflict: An overlapping outage schedule already exists for this area' },
          403: { description: 'Forbidden — requires POWER_OPERATOR or ADMIN' },
        },
      },
    },
    '/api/v1/outages/{id}': {
      get: {
        tags: ['Planned Outages & Schedules'],
        summary: 'Get Outage Details',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Outage details with area and technician assignments' }, 404: { description: 'Outage not found' } },
      },
      patch: {
        tags: ['Planned Outages & Schedules'],
        summary: 'Update Outage Schedule',
        security: [{ bearerAuth: [] }],
        description: 'Updates outage details or schedule times with advisory lock conflict detection. Allowed roles: `POWER_OPERATOR`, `ADMIN`.',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  description: { type: 'string' },
                  startTime: { type: 'string', format: 'date-time' },
                  estimatedEndTime: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Outage updated' }, 409: { description: 'Time conflict with another outage' } },
      },
      delete: {
        tags: ['Planned Outages & Schedules'],
        summary: 'Soft-Delete Outage',
        security: [{ bearerAuth: [] }],
        description: 'Soft-deletes an outage record by setting `deletedAt`. Allowed roles: `POWER_OPERATOR`, `ADMIN`.',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Outage soft-deleted successfully' } },
      },
    },
    '/api/v1/outages/{id}/cancel': {
      patch: {
        tags: ['Planned Outages & Schedules'],
        summary: 'Cancel Outage',
        security: [{ bearerAuth: [] }],
        description: 'Cancels a scheduled or in-progress outage and dispatches cancellation alerts to area customers. Allowed roles: `POWER_OPERATOR`, `ADMIN`.',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  cancellationReason: { type: 'string', example: 'Cancelled due to adverse weather conditions' },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Outage cancelled successfully' } },
      },
    },
    '/api/v1/outages/{id}/history': {
      get: {
        tags: ['Planned Outages & Schedules'],
        summary: 'Get Outage Status History & Audit Timeline',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Chronological timeline of status transitions and repair milestones' } },
      },
    },
    '/api/v1/outages/{id}/assignments': {
      get: {
        tags: ['Planned Outages & Schedules'],
        summary: 'List Technician Assignments for Outage',
        security: [{ bearerAuth: [] }],
        description: 'Lists all technicians assigned to this outage. Allowed roles: `POWER_OPERATOR`, `ADMIN`.',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Assignments list' } },
      },
    },
    '/api/v1/outages/{id}/assign': {
      post: {
        tags: ['Planned Outages & Schedules'],
        summary: 'Assign Technician to Outage',
        security: [{ bearerAuth: [] }],
        description: 'Assigns an available technician to an outage. **Uses PostgreSQL transaction advisory locks to guarantee no double-booking.** Allowed roles: `POWER_OPERATOR`, `ADMIN`.',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['technicianId'],
                properties: {
                  technicianId: { type: 'string', example: 'tech-rahim-01' },
                  notes: { type: 'string', example: 'Inspect transformer bushing and secondary fuses' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Technician assigned successfully' },
          409: { description: 'Conflict: Technician is currently assigned or unavailable' },
        },
      },
    },
    '/api/v1/outages/{id}/progress': {
      patch: {
        tags: ['Planned Outages & Schedules'],
        summary: 'Update Outage Repair Progress',
        security: [{ bearerAuth: [] }],
        description: 'Logs repair progress notes and updates status to `IN_PROGRESS`. Allowed roles: `POWER_OPERATOR`, `ADMIN`.',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['notes'],
                properties: {
                  notes: { type: 'string', example: 'Replaced faulty porcelain insulator; commencing phase testing.' },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Progress logged successfully' } },
      },
    },
    '/api/v1/outages/{id}/restore': {
      post: {
        tags: ['Planned Outages & Schedules'],
        summary: 'Log Outage Restoration',
        security: [{ bearerAuth: [] }],
        description: 'Marks an outage as `RESOLVED`, releases all assigned technicians back to `AVAILABLE`, and sends restoration notifications. Allowed roles: `POWER_OPERATOR`, `ADMIN`.',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  restorationNotes: { type: 'string', example: 'Grid feeder re-energized successfully. Voltage stable at 11kV.' },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Power restored and outage resolved' } },
      },
    },

    // -------------------------------------------------------------
    // CUSTOMER OUTAGE REPORTS
    // -------------------------------------------------------------
    '/api/v1/outage-reports': {
      get: {
        tags: ['Customer Outage Reports'],
        summary: 'List All Outage Reports',
        security: [{ bearerAuth: [] }],
        description: 'Lists all citizen outage reports with filters for status, severity, and area. Allowed roles: `POWER_OPERATOR`, `ADMIN`.',
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['PENDING', 'VERIFIED', 'RESOLVED', 'REJECTED'] } },
          { name: 'severity', in: 'query', schema: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] } },
          { name: 'areaId', in: 'query', schema: { type: 'string' } },
        ],
        responses: { 200: { description: 'Reports retrieved successfully' } },
      },
      post: {
        tags: ['Customer Outage Reports'],
        summary: 'Submit Citizen Outage Report',
        security: [{ bearerAuth: [] }],
        description: 'Allows an authenticated citizen (`CUSTOMER`) to report a sudden power loss or electrical fault in their area.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['title', 'description', 'areaId'],
                properties: {
                  title: { type: 'string', example: 'Sudden blackout on Gulshan Avenue' },
                  description: { type: 'string', example: 'Power cut at 3:15 PM without warning. Neighboring buildings also affected.' },
                  areaId: { type: 'string', example: 'area-gulshan-2-c' },
                  severity: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], default: 'MEDIUM' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Outage report submitted and placed in PENDING verification' },
          400: { description: 'Validation error' },
        },
      },
    },
    '/api/v1/outage-reports/my': {
      get: {
        tags: ['Customer Outage Reports'],
        summary: 'View My Outage Reports',
        security: [{ bearerAuth: [] }],
        description: 'Returns all outage reports submitted by the currently authenticated customer.',
        responses: { 200: { description: 'Customer report history retrieved' } },
      },
    },
    '/api/v1/outage-reports/{id}': {
      get: {
        tags: ['Customer Outage Reports'],
        summary: 'Get Report Details',
        security: [{ bearerAuth: [] }],
        description: 'Retrieves report details. Customers can view their own; Operators and Admins can view any.',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Report details' }, 404: { description: 'Report not found' } },
      },
      patch: {
        tags: ['Customer Outage Reports'],
        summary: 'Update Pending Report',
        security: [{ bearerAuth: [] }],
        description: 'Allows a customer to edit the title, description, or severity of their own report while it is still `PENDING`.',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  description: { type: 'string' },
                  severity: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Report updated' }, 400: { description: 'Cannot update non-pending report' } },
      },
      delete: {
        tags: ['Customer Outage Reports'],
        summary: 'Withdraw Report',
        security: [{ bearerAuth: [] }],
        description: 'Allows a customer to withdraw their own `PENDING` report, or an Admin to delete any report.',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Report withdrawn' } },
      },
    },
    '/api/v1/outage-reports/{id}/verify': {
      patch: {
        tags: ['Customer Outage Reports'],
        summary: 'Verify Outage Report',
        security: [{ bearerAuth: [] }],
        description: 'Operator verifies a customer report, transitioning its status to `VERIFIED` and triggering an in-app confirmation notification. Allowed roles: `POWER_OPERATOR`, `ADMIN`.',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  notes: { type: 'string', example: 'Verified feeder breaker trip via SCADA monitoring.' },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Report verified successfully' } },
      },
    },
    '/api/v1/outage-reports/{id}/reject': {
      patch: {
        tags: ['Customer Outage Reports'],
        summary: 'Reject Outage Report',
        security: [{ bearerAuth: [] }],
        description: 'Operator rejects an invalid or duplicate customer report, transitioning its status to `REJECTED`. Allowed roles: `POWER_OPERATOR`, `ADMIN`.',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['reason'],
                properties: {
                  reason: { type: 'string', example: 'Duplicate report: Outage already scheduled under ticket #9a5c.' },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Report rejected' } },
      },
    },

    // -------------------------------------------------------------
    // TECHNICIAN OPERATIONS
    // -------------------------------------------------------------
    '/api/v1/technicians': {
      get: {
        tags: ['Technician Operations'],
        summary: 'List Technicians',
        security: [{ bearerAuth: [] }],
        description: 'Lists all technicians with zone, specialization, and availability status. Allowed roles: `POWER_OPERATOR`, `ADMIN`.',
        parameters: [
          { name: 'isAvailable', in: 'query', schema: { type: 'boolean' } },
          { name: 'zoneId', in: 'query', schema: { type: 'string' } },
        ],
        responses: { 200: { description: 'Technicians list retrieved' } },
      },
      post: {
        tags: ['Technician Operations'],
        summary: 'Register New Technician',
        security: [{ bearerAuth: [] }],
        description: 'Registers a new field technician. **Strictly ADMIN role required**.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'phone', 'specialization', 'zoneId'],
                properties: {
                  id: { type: 'string', example: 'tech-kamal-02' },
                  name: { type: 'string', example: 'Kamal Hossain' },
                  phone: { type: 'string', example: '+8801722334455' },
                  specialization: { type: 'string', example: 'Substation Transformer & Relay Protection' },
                  zoneId: { type: 'string', example: 'cm1234567890' },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Technician registered' }, 403: { description: 'Forbidden' } },
      },
    },
    '/api/v1/technicians/{id}': {
      get: {
        tags: ['Technician Operations'],
        summary: 'Get Technician Details',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Technician details with active work order' } },
      },
      patch: {
        tags: ['Technician Operations'],
        summary: 'Update Technician Availability / Details',
        security: [{ bearerAuth: [] }],
        description: 'Updates technician contact info, specialization, or availability status. Allowed roles: `POWER_OPERATOR`, `ADMIN`.',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  isAvailable: { type: 'boolean' },
                  specialization: { type: 'string' },
                  phone: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Technician updated' } },
      },
      delete: {
        tags: ['Technician Operations'],
        summary: 'Delete Technician',
        security: [{ bearerAuth: [] }],
        description: 'Deletes a technician. **Strictly ADMIN role required**.',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Technician deleted' }, 403: { description: 'Forbidden' } },
      },
    },

    // -------------------------------------------------------------
    // IN-APP NOTIFICATIONS
    // -------------------------------------------------------------
    '/api/v1/notifications': {
      get: {
        tags: ['In-App Notifications'],
        summary: 'List Notifications',
        security: [{ bearerAuth: [] }],
        description: 'Retrieves all in-app notifications for the authenticated user, sorted with newest first.',
        parameters: [{ name: 'unreadOnly', in: 'query', schema: { type: 'boolean' } }],
        responses: { 200: { description: 'Notifications retrieved' } },
      },
    },
    '/api/v1/notifications/read-all': {
      patch: {
        tags: ['In-App Notifications'],
        summary: 'Mark All Notifications as Read',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'All notifications marked as read' } },
      },
    },
    '/api/v1/notifications/{id}/read': {
      patch: {
        tags: ['In-App Notifications'],
        summary: 'Mark Single Notification as Read',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Notification marked as read' } },
      },
    },

    // -------------------------------------------------------------
    // STRIPE PAYMENTS & CHECKOUT
    // -------------------------------------------------------------
    '/api/v1/payments/checkout': {
      post: {
        tags: ['Stripe Payments & Checkout'],
        summary: 'Initiate Stripe Checkout Session',
        security: [{ bearerAuth: [] }],
        description: 'Creates a real Stripe Checkout Session for a 30-day Premium Area Reliability Analytics subscription ($15.00 USD). Returns the Stripe-hosted checkout URL.',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  plan: { type: 'string', example: 'PREMIUM_MONTHLY' },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Checkout session created',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/StandardSuccessResponse' },
                example: {
                  success: true,
                  message: 'Checkout session created',
                  data: {
                    sessionId: 'cs_test_a1b2c3d4...',
                    url: 'https://checkout.stripe.com/c/pay/cs_test_a1b2c3d4...',
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/payments/my': {
      get: {
        tags: ['Stripe Payments & Checkout'],
        summary: 'Customer Payment History',
        security: [{ bearerAuth: [] }],
        description: 'Retrieves all historical payments and subscriptions for the authenticated customer.',
        responses: { 200: { description: 'Payment records retrieved' } },
      },
    },
    '/api/v1/payments/status/{sessionId}': {
      get: {
        tags: ['Stripe Payments & Checkout'],
        summary: 'Check Payment Status by Stripe Session ID',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'sessionId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Payment status returned (SUCCEEDED, PENDING, or FAILED)' } },
      },
    },
    '/api/v1/payments': {
      get: {
        tags: ['Stripe Payments & Checkout'],
        summary: 'List All Platform Payments',
        security: [{ bearerAuth: [] }],
        description: 'Lists all payment transactions across the platform. **Strictly ADMIN role required**.',
        responses: { 200: { description: 'All payment transactions' }, 403: { description: 'Forbidden' } },
      },
    },
    '/api/v1/payments/{id}': {
      get: {
        tags: ['Stripe Payments & Checkout'],
        summary: 'Get Payment Details',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Payment details' } },
      },
    },
    '/api/v1/payments/success': {
      get: {
        tags: ['Stripe Payments & Checkout'],
        summary: 'Informational Redirect on Stripe Success',
        description: 'Redirect landing page after customer completes Stripe Checkout.',
        responses: { 200: { description: 'HTML or JSON confirmation' } },
      },
    },
    '/api/v1/payments/cancel': {
      get: {
        tags: ['Stripe Payments & Checkout'],
        summary: 'Informational Redirect on Stripe Cancel',
        description: 'Redirect landing page if customer cancels Stripe Checkout.',
        responses: { 200: { description: 'Cancellation confirmation' } },
      },
    },

    // -------------------------------------------------------------
    // STRIPE WEBHOOKS
    // -------------------------------------------------------------
    '/api/v1/payments/webhook': {
      post: {
        tags: ['Stripe Webhooks'],
        summary: 'Stripe Webhook Receiver',
        description: 'Receives signed webhook events directly from Stripe servers. **Requires `stripe-signature` header and raw request body.** Enforces event deduplication via `ProcessedWebhookEvent` ledger to guarantee idempotency.',
        parameters: [
          {
            name: 'stripe-signature',
            in: 'header',
            required: true,
            schema: { type: 'string' },
            description: 'Cryptographic signature generated by Stripe using webhook signing secret.',
          },
        ],
        responses: {
          200: { description: 'Webhook processed successfully (`{ received: true }`)' },
          400: { description: 'Invalid signature or bad payload' },
        },
      },
    },

    // -------------------------------------------------------------
    // PREMIUM SERVICES & ANALYTICS
    // -------------------------------------------------------------
    '/api/v1/premium/status': {
      get: {
        tags: ['Premium Services & Analytics'],
        summary: 'Check Premium Subscription Status',
        security: [{ bearerAuth: [] }],
        description: 'Returns the authenticated user\'s subscription status, expiration date, and remaining entitlement days.',
        responses: {
          200: {
            description: 'Subscription status',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/StandardSuccessResponse' },
                example: {
                  success: true,
                  message: 'Subscription status retrieved',
                  data: {
                    hasActiveSubscription: true,
                    subscriptionValidUntil: '2026-12-15T10:00:00.000Z',
                    remainingDays: 30,
                    features: ['AREA_RELIABILITY_ANALYTICS', 'PRIORITY_OUTAGE_ALERTS'],
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/premium/area-analytics': {
      get: {
        tags: ['Premium Services & Analytics'],
        summary: 'Get Area Reliability Analytics',
        security: [{ bearerAuth: [] }],
        description: 'Calculates the real-time reliability index (0–100%) for an area using historical outage frequencies and cumulative downtime durations. **Requires an active Premium subscription or ADMIN role.**',
        parameters: [
          { name: 'areaId', in: 'query', required: true, schema: { type: 'string' }, description: 'Distribution area ID to analyze' },
        ],
        responses: {
          200: {
            description: 'Area reliability metrics retrieved successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/StandardSuccessResponse' },
                example: {
                  success: true,
                  message: 'Area reliability analytics calculated',
                  data: {
                    areaId: 'area-gulshan-2-c',
                    areaName: 'Gulshan-2 Sector C',
                    reliabilityScore: 94.5,
                    totalOutages: 3,
                    totalDurationHours: 4.5,
                    scoreCategory: 'EXCELLENT',
                  },
                },
              },
            },
          },
          403: { description: 'Forbidden — requires active Premium subscription or ADMIN role' },
        },
      },
    },

    // -------------------------------------------------------------
    // ADMIN USER MANAGEMENT
    // -------------------------------------------------------------
    '/api/v1/admin/users': {
      get: {
        tags: ['Admin User Management'],
        summary: 'List All Registered Users',
        security: [{ bearerAuth: [] }],
        description: 'Lists all users with pagination and filtering by role, active status, or search term. **Strictly ADMIN role required**.',
        parameters: [
          { name: 'role', in: 'query', schema: { type: 'string', enum: ['CUSTOMER', 'POWER_OPERATOR', 'ADMIN'] } },
          { name: 'isActive', in: 'query', schema: { type: 'boolean' } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
        ],
        responses: { 200: { description: 'Users list retrieved' }, 403: { description: 'Forbidden' } },
      },
    },
    '/api/v1/admin/users/{id}/role': {
      patch: {
        tags: ['Admin User Management'],
        summary: 'Update User Role',
        security: [{ bearerAuth: [] }],
        description: 'Changes a user\'s role (`CUSTOMER`, `POWER_OPERATOR`, `ADMIN`). **Strictly ADMIN role required**.',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['role'],
                properties: {
                  role: { type: 'string', enum: ['CUSTOMER', 'POWER_OPERATOR', 'ADMIN'], example: 'POWER_OPERATOR' },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'User role updated' }, 403: { description: 'Forbidden' } },
      },
    },
    '/api/v1/admin/users/{id}/status': {
      patch: {
        tags: ['Admin User Management'],
        summary: 'Update User Active / Banned Status',
        security: [{ bearerAuth: [] }],
        description: 'Activates, suspends, or bans a user account. **Strictly ADMIN role required**.',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['isActive'],
                properties: {
                  isActive: { type: 'boolean', example: false },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'User status updated' }, 403: { description: 'Forbidden' } },
      },
    },

    // -------------------------------------------------------------
    // ADMIN SYSTEM MONITORING & AUDIT LOGS
    // -------------------------------------------------------------
    '/api/v1/admin/audit-logs': {
      get: {
        tags: ['Admin System Monitoring & Audit Logs'],
        summary: 'Explore Audit Logs',
        security: [{ bearerAuth: [] }],
        description: 'Explores immutable audit trail logs, filterable by action, entityType, actorId, and date range. **Strictly ADMIN role required**.',
        parameters: [
          { name: 'action', in: 'query', schema: { type: 'string' } },
          { name: 'entityType', in: 'query', schema: { type: 'string' } },
          { name: 'actorId', in: 'query', schema: { type: 'string' } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
        ],
        responses: { 200: { description: 'Audit logs retrieved' }, 403: { description: 'Forbidden' } },
      },
    },
    '/api/v1/admin/stats': {
      get: {
        tags: ['Admin System Monitoring & Audit Logs'],
        summary: 'Get Platform System Statistics',
        security: [{ bearerAuth: [] }],
        description: 'Aggregates platform-wide metrics including total users by role, distribution entities, outage status counts, reports, technicians, and Stripe revenue. **Strictly ADMIN role required**.',
        responses: {
          200: {
            description: 'System stats retrieved',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/StandardSuccessResponse' },
              },
            },
          },
          403: { description: 'Forbidden' },
        },
      },
    },
  },
};

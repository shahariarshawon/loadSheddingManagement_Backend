# GridWatch — Load Shedding & Power Outage Management System

GridWatch is a production-grade backend REST API engineered to coordinate electrical grid load shedding, monitor unplanned outages, facilitate citizen fault reporting, automate technician dispatch, and provide premium area reliability analytics powered by Stripe payment fulfillment.

Developed for **Programming Hero B7A6 Assignment 6** (Student ID ending in **3**).

---

## 🔗 Important Links

- **Live Backend API**: [https://loadsheddingmanagement-backend.onrender.com](https://loadsheddingmanagement-backend.onrender.com)
- **Interactive Swagger UI**: [https://loadsheddingmanagement-backend.onrender.com/api-docs](https://loadsheddingmanagement-backend.onrender.com/api-docs)
- **OpenAPI 3.0.3 JSON Specification**: [https://loadsheddingmanagement-backend.onrender.com/api-docs.json](https://loadsheddingmanagement-backend.onrender.com/api-docs.json)
- **Health Check**: [https://loadsheddingmanagement-backend.onrender.com/api/v1/health](https://loadsheddingmanagement-backend.onrender.com/api/v1/health)
- **GitHub Repository**: [https://github.com/shahariarshawon/loadSheddingManagement_Backend](https://github.com/shahariarshawon/loadSheddingManagement_Backend)

---

## ⚡ Key Features

- **Hierarchical Power Network**: Structured four-tier power topology model (`Zone` → `Substation` → `Feeder` → `Area`) with referential integrity and safe-deletion cascades.
- **Concurrency-Safe Outage Scheduling**: Outage window conflict checks guarded by PostgreSQL transaction-scoped advisory locks (`pg_advisory_xact_lock`), preventing overlapping outages on the same area under high-concurrency race conditions.
- **Citizen Outage Reporting & Verification**: Citizens report sudden blackouts; power operators verify reports, converting them into active outage incidents, or reject duplicates with automated in-app notifications.
- **Technician Dispatch & Restoration**: Concurrency-safe field technician assignment, progress milestone logging, and power restoration tracking that automatically re-energizes feeders and frees technicians.
- **Real Stripe Payment & Webhooks**: Stripe Checkout session creation for a 30-day Premium Subscription ($15.00 USD), verified using Stripe raw-body webhook signatures with idempotency deduplication (`ProcessedWebhookEvent`).
- **Premium Area Reliability Analytics**: Subscription-gated mathematical analytics calculating the availability percentage and reliability rating for distribution areas based on historical downtime.
- **System Monitoring & Audit Logs**: Immutable platform audit trail recording every administrative action, user role update, and dispatch event alongside real-time aggregated metrics.

---

## 👥 Three-Role RBAC Model

The system enforces strict least-privilege Role-Based Access Control across exactly three roles:

| Role | Permissions & Responsibilities |
| :--- | :--- |
| **`CUSTOMER`** | Register and authenticate, update profile, view public outage schedules, submit outage reports, withdraw pending reports, receive in-app notifications, purchase premium subscriptions via Stripe Checkout, and view reliability analytics for subscribed areas. |
| **`POWER_OPERATOR`** | Plan and schedule load shedding outages, update outage timelines, verify or reject citizen reports, assign available technicians to outages, log repair progress, and record power restoration. |
| **`ADMIN`** | Unrestricted supervisory access: CRUD operations on the distribution grid hierarchy (`Zone`, `Substation`, `Feeder`, `Area`), manage user roles and account suspension, register technicians, inspect immutable audit logs, and view system-wide operational statistics. |

---

## 🛠️ Technology Stack

- **Runtime & Package Manager**: [Node.js](https://nodejs.org/) v24 + [Bun](https://bun.com/) v1.3.5
- **Framework**: [Express.js](https://expressjs.com/) v5 with TypeScript
- **Database**: [Neon](https://neon.tech/) Serverless PostgreSQL (pooled connection for runtime queries; direct unpooled for migrations)
- **ORM**: [Prisma](https://www.prisma.io/) v7.10.1 with `@prisma/adapter-neon`
- **Validation**: [Zod](https://zod.dev/) v4
- **Authentication**: JWT (JSON Web Tokens) with Refresh Token rotation + Google OAuth (GCP)
- **Payment Gateway**: [Stripe](https://stripe.com/) Checkout + Cryptographically Verified Webhooks
- **API Documentation**: OpenAPI 3.0.3 + [Swagger UI Express](https://github.com/scottie1984/swagger-ui-express)
- **Build Tool**: [tsup](https://tsup.egoist.dev/) (ESM bundle compilation)
- **Hosting**: [Render](https://render.com/)

---

## 🏗️ Architecture

GridWatch adopts a clean, modular, layered architecture:

```text
HTTP Request
     │
     ▼
[Middleware Layer]  ── Helmet, CORS, Rate Limiting, Raw Body Verifier
     │
     ▼
[Routing Layer]     ── /api/v1/auth, /api/v1/outages, /api/v1/payments, etc.
     │
     ▼
[Auth Guard Layer]  ── authenticateUser (JWT), authorizeRoles (CUSTOMER / OPERATOR / ADMIN)
     │
     ▼
[Controller Layer]  ── Request extraction, Zod schema validation, response dispatch
     │
     ▼
[Service Layer]     ── Business logic, transaction management, advisory locking, notifications
     │
     ▼
[Data Layer]        ── Prisma ORM Client (v7 with Neon Adapter)
     │
     ▼
[Database]          ── Neon Serverless PostgreSQL
```

---

## 🚀 Local Development Setup

### 1. Prerequisites
- [Bun](https://bun.com/) installed (`bun --version` >= 1.2) or Node.js (>= 20)
- PostgreSQL database instance (or a free [Neon](https://neon.tech) account)

### 2. Clone Repository
```bash
git clone https://github.com/shahariarshawon/loadSheddingManagement_Backend.git
cd loadSheddingManagement_Backend
```

### 3. Install Dependencies
```bash
bun install
```

### 4. Configure Environment Variables
Copy `.env.example` to `.env` and fill in your credentials:
```bash
cp .env.example .env
```

Ensure the following variables are defined:
```env
PORT=5000
NODE_ENV=development
DATABASE_URL=postgresql://user:password@ep-sample-pooler.neon.tech/neondb?sslmode=require
DATABASE_URL_UNPOOLED=postgresql://user:password@ep-sample.neon.tech/neondb?sslmode=require
JWT_ACCESS_SECRET=your_super_secret_access_token_key
JWT_REFRESH_SECRET=your_super_secret_refresh_token_key
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
CLIENT_URL=http://localhost:3000
```

### 5. Generate Prisma Client & Run Migrations
```bash
bun run db:generate
bun run db:deploy
```

### 6. Seed Initial Data
Seeds distribution zones, substations, feeders, areas, and demo accounts:
```bash
bun run db:seed
```

### 7. Run Development Server
```bash
bun run dev
```
The server will start on `http://localhost:5000`.

---

## 🧪 Automated Testing

GridWatch contains 6 automated test suites executing **229 end-to-end integration tests**:

```bash
bun run test
```

### Test Suite Breakdown:
- **Suite 1 (Phase 3)**: Authentication, JWT, Refresh Token Rotation, RBAC, Profile, Admin User Mgmt (48 tests)
- **Suite 2 (Phase 4)**: Distribution Network Hierarchy, Outage Planning & Safe Deletion (40 tests)
- **Suite 3 (Phase 5)**: Outage Reports, Operator Verification, Technician Assignment & Restoration (60 tests)
- **Suite 4 (Phase 6)**: Stripe Checkout, Webhook Raw-Body Verification & Premium Analytics (45 tests)
- **Suite 5 (Phase 7)**: Admin Audit Logs, Platform Stats, Rate Limiting & Concurrency Defenses (29 tests)
- **Suite 6 (Phase 8)**: Swagger UI, OpenAPI Specification & Production Readiness (7 tests)

---

## 📖 API Documentation & Swagger UI

Interactive API documentation is accessible in production at:
👉 **[https://loadsheddingmanagement-backend.onrender.com/api-docs](https://loadsheddingmanagement-backend.onrender.com/api-docs)**

Raw OpenAPI specification is available at:
👉 **[https://loadsheddingmanagement-backend.onrender.com/api-docs.json](https://loadsheddingmanagement-backend.onrender.com/api-docs.json)**

### Standard Response Envelope
All application responses adhere to a consistent contract:

**Success Response (HTTP 200 / 201):**
```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {}
}
```

**Error Response (HTTP 400 / 401 / 403 / 404 / 409 / 500):**
```json
{
  "success": false,
  "message": "Validation error or business rule violation",
  "errors": [
    {
      "field": "startTime",
      "message": "Start time must be in the future"
    }
  ]
}
```

---

## 💳 Stripe Payment & Webhook Architecture

1. **Checkout Initiation (`POST /api/v1/payments/checkout`)**: Authenticated customer creates a Stripe-hosted Checkout session.
2. **Customer Payment**: Customer completes payment on Stripe using test card `4242 4242 4242 4242`.
3. **Webhook Fulfillment (`POST /api/v1/payments/webhook`)**:
   - The endpoint receives the raw request buffer and verifies the cryptographic signature with `stripe.webhooks.constructEventAsync`.
   - The handler checks the `ProcessedWebhookEvent` ledger for event deduplication.
   - Upon `checkout.session.completed`, the customer's payment status transitions to `SUCCEEDED`, 30 days of Premium access is credited, and an in-app confirmation notification is created.
4. **Premium Feature Access (`GET /api/v1/premium/area-analytics`)**: Customers with verified active subscriptions access real-time power availability analytics and reliability ratings.

---

## 🔒 Security & Concurrency Defenses

- **PostgreSQL Advisory Locks**: All outage scheduling and technician assignments use `SELECT pg_advisory_xact_lock(hashtext(...))` inside interactive `$transaction` blocks to eliminate race conditions without database deadlocks.
- **Refresh Token Rotation**: Refresh tokens are issued with unique UUIDs (`jti`), hashed in the database, and invalidated upon use to prevent token replay.
- **Password Hashing**: Passwords hashed with `bcryptjs` (salt rounds: 10) and automatically omitted from all query responses.
- **Rate Limiting**: Sliding window rate limiting guards authentication routes against brute-force attacks (`express-rate-limit`).
- **Security Headers & CORS**: Hardened with `helmet` and domain-whitelisted `cors`.

---

## 📦 Production Deployment & Build

To compile and launch the production application:
```bash
bun run build
bun run start
```

- **Build Command on Render**: `bun install --frozen-lockfile && bun run build`
- **Start Command on Render**: `bun run start`

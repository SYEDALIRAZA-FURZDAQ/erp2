# ERP-PERN

A multi-tenant, modular ERP platform built on **PostgreSQL, Express, React and Node.js**, designed to run on
cPanel shared hosting (about 1 GB RAM) and move to a VPS later with no rewrite. First market: Pakistan
(FBR Digital Invoicing, PKR, local payroll and tax rules).

> **Status: Phase 0 + Phase 1 (core platform).** The foundation is here; the business modules are not built yet.
> See [What is built](#what-is-built) and [Roadmap](#roadmap).
>
> **Please read:** this code was written in an environment that could not reach the npm registry, so it has
> **not been compiled, run, or tested yet**. Your first step is the [verification checklist](#first-run-verification-do-this-first).

---

## What is built

| Area | Included |
|---|---|
| Multi-tenancy | Shared schema, `tenant_id` on every table, **PostgreSQL Row-Level Security (forced)**, transaction-scoped tenant context |
| Auth | Tenant sign-up, login by company code + email, short-lived JWT access token (kept in memory), rotating refresh token in an httpOnly cookie with reuse detection, lockout after 5 failed logins, rate limiting |
| Authorization | RBAC with `module.entity.action` permissions, custom roles per tenant, permission checks on every route |
| Audit | Append-only audit log (DB trigger blocks update/delete), written in the same transaction as the change, sensitive fields redacted |
| Numbering | Configurable document series, gap-free allocation inside the posting transaction |
| Company | Profile (NTN, STRN, CNIC, address), base currency, fiscal-year start month |
| Platform | Health endpoint with memory and pool stats, consistent error format, Zod validation, Helmet CSP, gzip, graceful shutdown |
| Frontend | React + Vite + Tailwind: login/register, users, roles and permissions, audit viewer, company and numbering settings |
| Deployment | One Node process serves the API and the built React app. `scripts/package-release.sh` builds a zip for cPanel. |

Design decisions worth knowing:

- **Modular monolith.** One deployable; modules under `server/src/modules/<name>`. Future modules talk through
  services and events, not each other's tables.
- **No native add-ons.** Password hashing uses Node's built-in `scrypt`; there is no Prisma engine, Puppeteer or
  argon2 build step, which keeps shared hosting happy.
- **Money rules for later modules:** `NUMERIC` only, never floats; posted ledger entries are immutable (reverse, don't edit).
- **Same origin.** The API and web app share one domain, so there is no CORS and no CSRF surface for the API.

## Project layout

```
erp-pern/
├─ server/
│  ├─ migrations/001_core.sql        # schema + RLS policies
│  ├─ src/
│  │  ├─ config/                     # env validation (zod), logger
│  │  ├─ db/                         # pool + withTenant(), migration runner
│  │  ├─ middleware/auth.ts          # JWT verify, permission gate
│  │  ├─ modules/{auth,users,roles,audit,numbering,company,health}
│  │  ├─ utils/                      # errors, scrypt password helpers
│  │  ├─ app.ts / server.ts
│  └─ tests/                         # unit + DB integration tests
├─ web/                              # React + Vite + Tailwind
├─ scripts/package-release.sh        # builds release/erp-pern-release.zip
├─ .env.example
├─ README.md
└─ DEPLOYMENT.md                     # step-by-step cPanel guide
```

## Run it locally

Requirements: Node.js 18+ (22 recommended) and a PostgreSQL 13+ database you can write to.

```bash
cp .env.example server/.env       # then edit DATABASE_URL and the two JWT secrets
# generate secrets:  node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
# for local dev set COOKIE_SECURE=false

npm install
npm run migrate:dev -w server     # creates the tables
npm run dev:server                # API on http://localhost:3000
npm run dev:web                   # UI on  http://localhost:5173 (proxies /api to :3000)
```

Open http://localhost:5173/register, create a company, and you are signed in as its Owner.

## First run verification (do this first)

Nothing below has been executed yet. Run it in order and fix anything that fails before building further:

```bash
npm install
npm run typecheck                 # server (tsc) and web (tsc)
npm test                          # unit tests (no database needed)

# Integration tests, including the tenant-isolation proof. Use a THROWAWAY database:
TEST_DATABASE_URL=postgres://user:pass@localhost:5432/erp_test npm test

npm run build
```

The integration tests prove: one tenant cannot read another's users through the API; the database itself hides other
tenants' rows and rejects cross-tenant writes; missing/invalid tokens get 401 and missing permission gets 403; refresh
token reuse revokes the session family; and the account locks after repeated failures.

## Configuration

All settings are environment variables (see `.env.example`). Required: `DATABASE_URL`, `JWT_ACCESS_SECRET`,
`JWT_REFRESH_SECRET`. The server refuses to start with missing or weak values.

| Variable | Purpose | Default |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | none |
| `DB_POOL_MAX` | Max DB connections (keep 5 to 10 on shared hosting) | 5 |
| `COOKIE_SECURE` | `true` when served over HTTPS | false |
| `SERVE_WEB` | Serve the built React app from Node | true |
| `ALLOW_TENANT_SIGNUP` | Allow public company sign-up | true |
| `ACCESS_TOKEN_TTL_MIN` / `REFRESH_TOKEN_TTL_DAYS` | Session lifetimes | 15 / 14 |
| `CORS_ORIGINS` | Only needed if the web app is on another origin | empty |

Set `ALLOW_TENANT_SIGNUP=false` once your own company exists if you want to onboard customers by hand.

## API quick reference

Base path `/api/v1`. Errors look like `{ "error": { "code", "message", "details?" } }`.

| Method and path | Permission |
|---|---|
| `GET /health` | public |
| `POST /auth/register-tenant`, `/auth/login`, `/auth/refresh`, `/auth/logout` | public (rate limited) |
| `GET /auth/me` | signed in |
| `GET/POST /users`, `PATCH /users/:id`, `POST /users/:id/reset-password` | `core.users.read` / `core.users.manage` |
| `GET/POST /roles`, `PUT/DELETE /roles/:id`, `GET /roles/permissions` | `core.roles.read` / `core.roles.manage` |
| `GET /audit` | `core.audit.read` |
| `GET/PUT /company` | `core.settings.read` / `core.settings.manage` |
| `GET /numbering`, `PUT /numbering/:id` | `core.settings.read` / `core.numbering.manage` |

## Adding a module (pattern for the next phases)

1. Add a migration `00N_<module>.sql`. Every table gets `tenant_id`, the same `ENABLE` + `FORCE ROW LEVEL SECURITY`
   and `tenant_isolation` policy as in `001_core.sql`.
2. Create `server/src/modules/<module>/` with routes, service and validation. Use `withTenant()` for all queries and
   call `writeAudit()` inside the same transaction.
3. Add the permission keys to `permissions.ts` and mount the router in `app.ts`.
4. Allocate document numbers with `nextDocNumber()` in the same transaction that saves the document.
5. Add tests, including a cross-tenant isolation test for the new tables.

## Roadmap

| Phase | Scope | Status |
|---|---|---|
| 0 | Scaffold, config, migrations, deployment guide | written, unverified |
| 1 | Auth, tenants, RBAC, audit, numbering, company settings | written, unverified |
| 1b | Not yet done from the Phase 1 spec: workflow/approvals engine, notifications, attachments, email verification and password reset by email, TOTP 2FA, branches UI, background jobs (pg-boss), Urdu/RTL localisation, subscription plans | planned |
| 2 | Accounting: chart of accounts, vouchers, general ledger, reports | implemented ✓ |
| 3 | Sales, inventory, **FBR Digital Invoicing & QR** | implemented ✓ |
| 4 | Purchase and supply chain, vendor bills, inventory receiving | implemented ✓ |
| 5 | HR, attendance, payroll (Pakistani income tax slabs, EOBI, payslips) | implemented ✓ |
| 6 | Fixed assets, straight-line depreciation engine | implemented ✓ |
| 7 | Projects, tasks tracking, timesheets and expenses | implemented ✓ |
| 8 | Distribution, BI dashboards, subscription billing, hardening | planned |

**Before Phase 3 and Phase 5:** obtain the official FBR Digital Invoicing technical specification and the current tax,
EOBI and social-security rates. Statutory values must be configurable and effective-dated, never hard-coded, and field
names must come from the official documents, not from memory.

## Honest limits of shared hosting

1 GB RAM and a 100-process cap are fine for development and a handful of customers. Plan a move to a small VPS
(2 to 4 GB, Ubuntu, Nginx, PM2) once you have paying clients; see the last section of `DEPLOYMENT.md`.
You also have a shared IP, which matters if FBR requires IP allow-listing.


npm run dev:server

npm run dev:web 
#   e r p 2  
 
<div align="center">

# ⚡ ERP-PERN Enterprise Hub

### Modern, Multi-Tenant Cloud ERP & Financial Ledger Platform

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7+-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-336791?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Node.js](https://img.shields.io/badge/Node.js-22+-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18+-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-3.4+-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)

<p align="center">
  A lightweight, high-performance, modular enterprise resource planning platform engineered with <b>PostgreSQL Row-Level Security (RLS)</b>, <b>Express</b>, <b>React</b>, and <b>Node.js</b>.<br>
  Built with first-class support for <b>Pakistan Statutory Compliance (FBR Digital POS Invoicing, EOBI, Income Tax Slabs)</b>, multi-currency accounting, and scalable multi-tenancy.
</p>

[Explore Modules](#-core-business-modules) • [Quick Start](#-quick-start) • [Architecture](#-architecture) • [Security](#-security--compliance) • [API Guide](#-api-quick-reference)

</div>

---

## 🌟 Key Highlights

- 🏢 **Hardware-Isolated Multi-Tenancy**: Shared database schema with enforced PostgreSQL **Row-Level Security (RLS)** ensuring strict tenant separation.
- 🧾 **FBR Digital POS Invoicing**: Native QR code generation, real-time fiscalization, and sales tax compliance with Pakistan Federal Board of Revenue specifications.
- 📊 **Real-Time Financial Ledger**: Full double-entry bookkeeping, Chart of Accounts, Journal Vouchers (JV, CV, BV, SI, PI), General Ledger, Trial Balance, and Profit & Loss (Income Statement).
- 🛡️ **Owner Reversal & Deletion Protection**: Cryptographically verified owner-level controls for voiding vouchers, resetting payrolls, and stock ledger purges.
- 🌐 **Bilingual (English & Urdu اردو)**: Built-in internationalization with instant RTL layout switching and localized numeral formatting.
- 🚀 **Ultra-Efficient Deployment**: Operates seamlessly within constrained environments (cPanel ~1GB RAM) and scales effortlessly to high-availability VPS/Kubernetes clusters.

---

## 📦 Core Business Modules

| Module | Features & Capabilities |
| :--- | :--- |
| **📊 Dashboard & Analytics** | Real-time KPI summary (Total Sales Revenue, Inventory Stock Alerts, Attendance Ratio, Active Projects), synchronized with the accounting General Ledger. |
| **💼 Financial Accounting** | Hierarchical Chart of Accounts (Assets, Liabilities, Equity, Revenue, Expenses), Journal Voucher creation, running balances, Trial Balance, and automated Income Statements. |
| **🧾 Sales & Digital Invoicing** | Customer directory, tax-compliant invoicing, instant FBR POS sync, cryptographic QR codes, credit terms, and status workflows (`Draft` → `Posted` → `Paid` → `Cancelled`). |
| **📦 Inventory & Warehouses** | SKU master catalog, multi-warehouse allocations, low-stock reorder warnings, unit-cost tracking, stock adjustments, and safety-locked stock ledger deletion. |
| **🛍️ Purchase & Supply Chain** | Vendor management, purchase bills, goods receipt auto-posting into inventory, and accounts payable ledger synchronization. |
| **👥 HR & Payroll** | Employee directories, salary breakdown (Basic, House Rent, Medical, Allowances), Pakistan Income Tax slabs, EOBI deductions, payslip generation, and bank payment runs. |
| **📅 Attendance & Leaves** | Daily check-in/out tracking, automated late-arrival grace calculation, half-day detection, leave quotas, and supervisor approval pipelines. |
| **🏢 Fixed Assets** | Asset register, acquisition tracking, salvage value calculation, straight-line depreciation engine, and automated GL depreciation postings. |
| **🎯 Projects & Operations** | Client engagements, milestone task boards, priority tracking, team assignment, and progress reporting. |
| **⚙️ Settings & Administration** | Document numbering rules (`INV-2026-0001`), working week schedule (Saturday rules, grace periods), audit log explorer, and owner transaction reversal console. |

---

## 🏗️ Architecture

```mermaid
graph TD
    Client[Web Browser / Mobile PWA] -->|HTTPS / REST API| Express[Express Node.js Server]
    
    subgraph Security & Middleware
        Express --> Auth[JWT + Rotating Refresh Cookies]
        Auth --> RBAC[Role-Based Access Control]
        RBAC --> Audit[Tamper-Proof Audit Logger]
    end

    subgraph Business Engine
        Audit --> Accounting[Accounting & Ledger Service]
        Audit --> Sales[Sales & FBR Engine]
        Audit --> Inventory[Inventory & Stock Movements]
        Audit --> HR[HR, Attendance & Payroll Engine]
        Audit --> Assets[Fixed Assets & Projects]
    end

    subgraph Database Layer
        Accounting & Sales & Inventory & HR & Assets --> Pool[pg Connection Pool]
        Pool --> RLS[PostgreSQL Row-Level Security]
        RLS --> DB[(PostgreSQL Database)]
    end
```

### Technical Design Principles
1. **Modular Monolith**: Clean module isolation under `server/src/modules/*` for easy maintenance without distributed microservice overhead.
2. **PostgreSQL RLS by Default**: Every query runs through `withTenant()` setting `app.current_tenant_id` at the database transaction level.
3. **Immutable Financials**: Financial records follow standard accounting rules—immutable ledger entries are reversed or voided with full audit trails rather than arbitrarily deleted.
4. **Zero Heavy Add-ons**: Cryptographic hashing utilizes Node.js native `crypto.scrypt`—avoiding finicky native compilation issues on shared hosting environments.

---

## 🚀 Quick Start

### Prerequisites
- **Node.js**: v18.0.0 or higher (v20+ or v22+ recommended)
- **PostgreSQL**: v14.0 or higher
- **npm** or **pnpm**

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/your-username/erp-pern.git
cd erp-pern

# Install dependencies for both server and frontend
npm install
```

### 2. Configure Environment

Copy the example environment files and configure your PostgreSQL database credentials:

```bash
# Server configuration
cp .env.example server/.env
```

Edit `server/.env`:
```env
PORT=3000
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/erp_pern
DB_POOL_MAX=10
DB_SSL=false
COOKIE_SECURE=false

# Generate secure random keys with: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
JWT_ACCESS_SECRET=your_super_secret_access_key
JWT_REFRESH_SECRET=your_super_secret_refresh_key
ACCESS_TOKEN_TTL_MIN=15
REFRESH_TOKEN_TTL_DAYS=14
```

### 3. Run Database Migrations

```bash
npm run migrate:dev -w server
```

*(Optional: Run test seeds to populate standard Pakistani accounts and dummy datasets)*
```bash
npx tsx server/src/db/seed_modules.ts
```

### 4. Start Development Servers

Run the backend and frontend concurrently:

```bash
# Terminal 1: Backend API server (http://localhost:3000)
npm run dev:server

# Terminal 2: Vite React Frontend (http://localhost:5173)
npm run dev:web
```

Navigate to **[http://localhost:5173](http://localhost:5173)** in your browser and register your primary company owner account.

---

## 🔒 Security & Compliance

| Security Measure | Implementation Details |
| :--- | :--- |
| **Row-Level Security (RLS)** | PostgreSQL policies enforce isolation: `CREATE POLICY tenant_isolation ON table USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)`. |
| **Authentication** | Short-lived in-memory JWTs (15 min) + secure HttpOnly rotating refresh cookies (14 days) with automatic session hijacking detection. |
| **Brute-Force Guard** | Automatic account lockouts after 5 consecutive failed attempts, rate-limiting on sensitive endpoints. |
| **Immutable Audit Trail** | Append-only database table with triggers blocking updates and deletions. Tracks user, action, old/new diffs, timestamps, and IP addresses. |
| **Owner Guarded Reversals** | Destructive actions (payroll resets, voucher reversals, warehouse purges) require explicit owner cryptographic password verification. |

---

## 📁 Repository Structure

```
ERP WebApp/
├── server/                        # Backend REST API
│   ├── migrations/                # Versioned SQL migrations (001 - 004)
│   ├── src/
│   │   ├── config/                # Environment schema (Zod) & Pino logger
│   │   ├── db/                    # PostgreSQL pool, RLS wrapper, migration engine
│   │   ├── middleware/            # JWT verification & RBAC authorization
│   │   ├── modules/               # Domain-driven modular services
│   │   │   ├── accounting/        # Chart of accounts, vouchers, ledger, P&L
│   │   │   ├── assets/            # Fixed asset register & depreciation engine
│   │   │   ├── attendance/        # Time tracking & leave requests
│   │   │   ├── audit/             # Tamper-proof audit logs
│   │   │   ├── auth/              # Sign-up, sessions, token rotation
│   │   │   ├── company/           # Tenant profile, schedules & reversal console
│   │   │   ├── hr/                # Employees, tax brackets & payroll runs
│   │   │   ├── inventory/         # Stock items, movements & warehouses
│   │   │   ├── numbering/         # Auto-incrementing document series
│   │   │   ├── projects/          # Projects, milestones & tasks
│   │   │   ├── purchase/          # Vendors & purchase bills
│   │   │   ├── roles/             # RBAC role matrix & custom permissions
│   │   │   ├── sales/             # Invoicing & FBR POS fiscalization
│   │   │   └── users/             # User directory & credentials
│   │   └── server.ts              # Server lifecycle & graceful shutdown
│   └── tests/                     # Vitest unit & multi-tenant isolation tests
├── web/                           # Frontend Single Page Application (SPA)
│   ├── src/
│   │   ├── components/            # Reusable UI component design system
│   │   ├── lib/                   # API clients, Auth providers, i18n
│   │   ├── pages/                 # Full-featured application views
│   │   │   ├── AccountingPage.tsx # GL, Trial balance, Income statement
│   │   │   ├── AttendancePage.tsx # Employee attendance & check-ins
│   │   │   ├── Dashboard.tsx      # Executive metrics & sales sync
│   │   │   ├── FixedAssetsPage.tsx# Asset management
│   │   │   ├── HrPayrollPage.tsx  # Payroll processing & tax calculations
│   │   │   ├── InventoryPage.tsx  # Stock ledger & warehouse stock
│   │   │   ├── ProjectsPage.tsx   # Project tracking & boards
│   │   │   ├── PurchasePage.tsx   # Supplier bills & goods receipts
│   │   │   ├── SalesPage.tsx      # FBR POS invoicing & QR verification
│   │   │   └── SettingsPage.tsx   # Company settings & owner consoles
│   │   └── App.tsx                # Client-side routing & navigation
└── scripts/                       # Deployment & packaging automation
```

---

## 🛠️ Testing & Verification

Run the comprehensive test suite and TypeScript verification:

```bash
# Verify TypeScript typing across server and web
npm run typecheck

# Run backend unit test suites
npm test
```

---

## 🚢 Deployment

### Production Build
```bash
# Build React web application bundle
npm run build:web

# Build Node.js backend
npm run build:server
```

### Shared Hosting & cPanel (LiteSpeed / Passenger)
1. Run `scripts/package-release.sh` to produce a standalone zip file.
2. In cPanel, navigate to **Setup Node.js App** (Node.js 18+ or 20+).
3. Set your application root, upload the artifact, and define environment variables.
4. Set `SERVE_WEB=true` so the Node process serves the static web bundle alongside the API seamlessly from a single port.

---

## 📄 License

This project is licensed under the **MIT License** — feel free to use and adapt it for commercial and private deployments.

---

<div align="center">
  <b>Engineered with ❤️ for Furzdaq enterprises </b>
</div>
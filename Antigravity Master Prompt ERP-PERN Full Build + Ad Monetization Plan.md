# Antigravity Master Prompt: ERP-PERN Full Build + Ad Monetization Plan

*How to use: paste the block under "MASTER PROMPT" into Antigravity's Agent Manager in Planning mode, with your ERP-PERN repo open as the workspace. Then paste each phase prompt (Part 3) one at a time, after the previous phase passes its gate.*

---

## Part 1: MASTER PROMPT (paste this first)

```
You are the lead architect and a team of senior engineers building ERP-PERN, a multi-tenant, modular ERP for
the Pakistani market (PKR, FBR Digital Invoicing, local payroll and tax rules), on PostgreSQL, Express, React
and Node.js. The repository in this workspace already contains Phase 0 and Phase 1 (core platform). Read
README.md, DEPLOYMENT.md, server/migrations/001_core.sql and every module under server/src/modules first.

YOUR MISSION
Take this codebase from "core platform, unverified" to a complete, production-grade, modern ERP with an
excellent UI/UX and a built-in, tenant-safe advertising and subscription layer that lets the owner monetize
the platform. Work in phases. Do not skip the gates.

WORKING MODE (important)
1. Start in Planning mode. Before writing code, produce these artifacts: an Implementation Plan, a Task List,
   and a Risk Register. Wait for my approval of the plan before building Phase 2 or later.
2. For every phase: plan, build, run typecheck + tests, run the app, verify the UI with the browser agent
   (screenshots and a short recording of the main flows), then produce a Walkthrough artifact listing what
   changed, what was verified, and what is still open.
3. Never claim something works unless you ran it. If something cannot be run (no network, no database),
   say so explicitly and list it as unverified.
4. Keep commits small and phase-scoped. Write migration files, never edit applied migrations.

NON-NEGOTIABLE ARCHITECTURE RULES (already in the repo; preserve them)
- Modular monolith: one deployable, modules in server/src/modules/<name>. Modules talk through services and
  events, never through each other's tables.
- Multi-tenancy: shared schema, tenant_id on every table, ENABLE + FORCE ROW LEVEL SECURITY, a tenant_isolation
  policy on every new table, all queries inside withTenant(). Every new module ships a cross-tenant isolation
  test.
- Auth/RBAC: permissions are module.entity.action. Every route is permission-gated. Add keys to permissions.ts.
- Audit: writeAudit() inside the same transaction as the change; the audit log stays append-only.
- Money: NUMERIC only, never floats. Posted ledger entries are immutable; reverse, do not edit.
- Numbering: nextDocNumber() inside the posting transaction, gap-free.
- No native add-ons (no Prisma engine, Puppeteer, argon2 builds). The app must still run on cPanel shared
  hosting with about 1 GB RAM and a small DB pool, and move to a VPS with no rewrite. For PDFs use a pure-JS
  approach (for example pdfkit or pdf-lib) or server-rendered HTML print views.
- Statutory values (tax rates, EOBI, social security, withholding) are configurable and effective-dated, never
  hard-coded. FBR Digital Invoicing field names and payloads must come from the official FBR technical
  specification, not from memory. If the spec is not in the repo, build an adapter interface with a mock
  implementation and ask me for the document. Do not invent field names.

PRODUCT SCOPE (build in this order)
Phase 2 Accounting: chart of accounts, vouchers, general ledger, trial balance, P&L, balance sheet, cash book.
Phase 3 Sales, inventory, POS-lite, FBR Digital Invoicing integration (behind an adapter, sandbox first).
Phase 4 Purchase and supply chain, AR/AP, bank reconciliation, payments.
Phase 5 HR, attendance, leave, payroll with configurable statutory rules, payslips.
Phase 6 Fixed assets and expenses.
Phase 7 Projects, CRM, network/IT services (tickets, SLAs, contracts).
Phase 8 Distribution, BI dashboards, subscription billing, hardening.
Cross-cutting (Phase 1b): approvals/workflow engine, notifications, attachments, email verification and
password reset by email, TOTP 2FA, branches, background jobs (pg-boss), Urdu/RTL localisation, plans.

MODERN UI/UX REQUIREMENTS (applies to every screen)
- Design system first: tokens for color, type, spacing, radius, elevation; light and dark themes; one
  component library (build on Tailwind plus Radix/shadcn-style primitives). Document it in /web/DESIGN.md.
- App shell: collapsible sidebar grouped by module, top bar with tenant/branch switcher, global search,
  command palette (Ctrl/Cmd+K), notifications, user menu, breadcrumbs.
- Productivity: keyboard shortcuts, saved filters and views, inline editing in tables, bulk actions, sticky
  headers, column chooser, CSV/Excel export, fast keyboard-friendly voucher and invoice entry grids.
- Data tables: server-side pagination, sorting, filtering; skeleton loaders; empty states with a clear next
  action; optimistic updates where safe; friendly, specific error messages.
- Dashboards: role-based home screens with KPI cards, sparklines and charts (cash, receivables, payables,
  sales trend, stock alerts), each drillable to the underlying records.
- Responsive and touch friendly: usable on a phone for approvals, attendance and quick sales; desktop first
  for dense data entry.
- Accessibility: WCAG 2.2 AA, full keyboard navigation, visible focus, proper labels, color-contrast checks.
- Localisation: English and Urdu with full RTL layout, Urdu-friendly font stack, PKR formatting, Pakistani
  date and number conventions, switchable per user.
- Performance budget: initial JS under 250 KB gzipped for the shell, route-level code splitting, lazy loaded
  charts, no layout shift. Report bundle size each phase.
- Onboarding: guided first-run wizard (company profile, fiscal year, chart of accounts template, first user
  roles), sample data option, contextual help tooltips.

MONETIZATION LAYER (advertising + plans) - see Part 2 of the plan for the full spec. Build it as its own
module (server/src/modules/ads and web/src/features/ads) in Phase 1c, BEFORE the business modules, so every
later screen reserves its ad slots through one shared component.

DEFINITION OF DONE FOR EVERY PHASE
- typecheck, lint, unit tests and DB integration tests pass; new tables have RLS and an isolation test.
- No console errors in the browser agent run; main flows recorded.
- Migrations apply on a clean database and on the previous phase's database.
- README, API reference and DEPLOYMENT.md updated; release zip builds with scripts/package-release.sh.
- Walkthrough artifact produced; open issues listed honestly.

START NOW with Phase 0 verification (Part 3, Phase 0). Do not start Phase 1c or later until I approve.
```

---

## Part 2: Monetization and ad-space plan

### 2.1 Business model

Use a hybrid so ads never become the only revenue stream and never annoy paying customers:

| Plan | Price model | Ads | Notes |
| --- | --- | --- | --- |
| Free / Starter | Free, limited users and documents | Ads shown in designated slots | Lead generation and revenue from reach |
| Pro | Monthly or yearly per company | **Ad-free** | Main recurring revenue |
| Business | Per user per month plus modules | Ad-free, optional "partner offers" opt-in | Add-on modules sold separately |
| Partner/white-label | Annual fee | Partner's own branding or none | Resellers and accountants |

Additional revenue: sponsored listings (banks, insurers, couriers, payment gateways, hardware and ISP vendors), referral and affiliate offers, premium integrations, and paid support.

### 2.2 Important policy and trust notes (the agent must follow these)

- **Do not rely on Google AdSense inside the logged-in app.** Its policies generally restrict ads on pages behind a login or without public publisher content. Use it, if at all, only on public pages (marketing site, blog, help centre). Inside the app, use **direct-sold, house, and partner ads** served from our own ad module.
- **Never use tenant business data for ad targeting** (invoices, customers, salaries, balances). Targeting may use only coarse, non-sensitive signals: plan, language, module in use, company size band, city or province if the company profile already contains it.
- **No third-party trackers or tracking pixels** in the app. Impressions and clicks are counted by our own server. Add a clear privacy page and an ad-disclosure label ("Sponsored" or "Ad") on every ad.
- **No ads in sensitive or high-focus screens**: posting/confirming vouchers, payroll runs, payslips, tax and FBR screens, printed documents and PDFs, login and password screens, error dialogs, anything a user must read carefully.
- Ads must never block interaction, shift layout, or imitate system buttons or alerts.
- Admin controls at three levels: platform owner (everything), tenant admin (can hide ads by upgrading), user (can report an ad).

### 2.3 Where the ad slots live

Define a slot registry so every slot has a stable key, allowed sizes, and rules. The UI reserves the space with a fixed height so nothing jumps.

| Slot key | Location | Format | Notes |
| --- | --- | --- | --- |
| `dashboard.top_banner` | Top of home dashboard | 728x90 / responsive banner | Highest visibility, one ad |
| `dashboard.side_card` | Right column of dashboard | 300x250 card | Native-looking card, labeled |
| `sidebar.footer_promo` | Bottom of sidebar | Small 240x120 tile | Collapses when sidebar collapses |
| `list.inline_native` | Between rows 5 and 6 of long list pages | Native row-style card | Max one per page |
| `report.footer_banner` | Below reports on screen | Banner | **Not in print or export** |
| `empty_state.suggestion` | Empty-state screens | Native suggestion card | Contextual, e.g. a bank offer on an empty bank module |
| `marketplace.featured` | Integrations/marketplace page | Sponsored listing | Partner placements |
| `email.footer` | System emails (non-transactional only) | Text + link | Never in password or security mails |
| `public.help_center` | Public help/blog pages | Banner | Only place where an external ad network may be used |

### 2.4 Ad module: data model and features

Tables (all with `tenant_id` where tenant-owned; platform-owned tables are accessed only by the platform-admin role and documented as RLS exceptions with their own tests):

- `ad_advertisers` (name, contact, status)
- `ad_campaigns` (advertiser, name, start/end, budget, priority, status, pricing model: flat fee, CPM, CPC)
- `ad_creatives` (campaign, slot sizes, image or text, headline, body, CTA, destination URL, approval status, alt text)
- `ad_placements` (campaign to slot key, targeting rules JSON: plan, language, module, province, company size band)
- `ad_impressions` and `ad_clicks` (aggregated daily by campaign, slot, tenant; keep raw rows short-lived to save storage)
- `ad_settings` (global kill switch, per-slot enable, frequency caps, default house-ad fallback)
- `ad_reports_cache` (daily rollups for fast dashboards)

Features:

1. **Platform Ad Manager** (platform-admin only): create advertisers, campaigns, creatives; approve creatives; schedule; set targeting and caps; see impressions, clicks, CTR, spend, and revenue; export CSV; pause instantly.
2. **Serving API**: `GET /api/v1/ads/slot/:slotKey` returns zero or one ad, chosen by priority, targeting, budget remaining, frequency cap and a fair rotation. Falls back to a house ad (for example "Upgrade to Pro to remove ads") when no campaign matches. Returns nothing for ad-free plans.
3. **Tracking**: `POST /ads/impression` and a redirecting `GET /ads/click/:id` with signed, expiring tokens to block fraud; per-user and per-IP rate limits; bot filtering; dedupe within a short window.
4. **Frontend**: one `<AdSlot slotKey="..." />` component. It reserves height, lazy-loads, labels "Sponsored", offers a "Why am I seeing this? / Report ad / Remove ads (upgrade)" menu, never renders in print, and respects `prefers-reduced-motion`.
5. **Plan gate**: a single `shouldShowAds(tenant, user, route)` function reads plan, feature flags and the sensitive-screen deny list. Upgrading removes ads immediately.
6. **Consent and privacy**: ad preferences page; no personal data leaves the server; impression logs hold tenant and slot only, not user names.
7. **Revenue reporting**: monthly statements per advertiser, invoice generation using the numbering module, and an owner dashboard (fill rate, eCPM, revenue by slot, revenue by advertiser, churn caused by ads).
8. **Safety**: creative review queue, URL scheme allow-list (https only), image size and type limits, sanitised text, CSP updated only for approved image hosts, kill switch.
9. **Experimentation** (later): A/B test slot placement and measure effect on retention so ads do not hurt conversion to paid plans.

### 2.5 Subscription and billing module (supports the plans above)

Plans, features and limits tables; per-tenant subscription state; usage metering (users, documents, storage); trial period; grace period; manual payment recording for Pakistan (bank transfer, Easypaisa/JazzCash references) first, with a payment-gateway adapter interface to add a local gateway later; dunning emails; invoice per billing cycle through the sales module; downgrade rules that never delete data.

---

## Part 3: Phase-by-phase development plan with ready-to-paste prompts

Each phase lists the goal, the prompt to paste, and the gate that must pass before the next one.

### Phase 0: Verify what exists (do this first)

**Prompt:** "Run the First run verification checklist from README.md: npm install, npm run typecheck, npm test, integration tests against a throwaway Postgres database, and npm run build. Fix every failure with minimal, well-explained changes. Then start the app, and with the browser agent register a company, log in, create a user and a custom role, change numbering, and view the audit log. Report all fixes made and anything that could not be verified."

**Gate:** all commands green, tenant-isolation tests pass, browser walkthrough recorded.

### Phase 1a: Design system and app shell

**Prompt:** "Create the design system and app shell described in the MODERN UI/UX REQUIREMENTS. Deliver tokens, light and dark themes, core components (button, input, select, combobox, date picker, table, dialog, drawer, toast, tabs, badge, card, skeleton, empty state), the sidebar and top bar, command palette, breadcrumbs, and /web/DESIGN.md. Rebuild the existing pages (login, register, users, roles, audit, company, numbering) on it. Add English and Urdu with RTL. Report bundle size."

**Gate:** accessibility checks pass, no console errors, RTL screenshots verified, bundle budget met.

### Phase 1b: Platform completions

**Prompt:** "Implement the Phase 1b items: workflow and approvals engine (configurable steps, thresholds, delegation), notifications (in-app and email), attachments (local disk storage behind a storage interface, size and type limits, virus-scan hook), email verification and password reset by email, TOTP 2FA with recovery codes, branches with branch-level permissions and a UI, background jobs using pg-boss with a safe low-memory configuration, and tenant plans. Add tests including cross-tenant isolation for every new table."

**Gate:** all tests pass, memory use stays within the shared-hosting budget under a simple load test.

### Phase 1c: Monetization layer (ads + plans)

**Prompt:** "Build the ads module and plan gating exactly as specified in Part 2 of the plan (slot registry, platform Ad Manager UI, serving API, signed tracking, AdSlot component, shouldShowAds, creative review, reports, kill switch, house ads). Place the slots listed in the registry on the existing screens. Respect every rule in 2.2. Add tests for targeting, frequency caps, budget exhaustion, plan gating, sensitive-screen deny list, click-token forgery and tenant isolation."

**Gate:** ad-free plan shows zero ads, print and PDF never contain ads, forged clicks rejected, no layout shift (Lighthouse CLS under 0.05).

### Phase 2: Accounting

**Prompt:** "Build the accounting module: chart of accounts with Pakistan-friendly templates, fiscal years and periods with locking, journal/payment/receipt/contra vouchers with draft, approve and post states, immutable posting with reversal, general ledger, trial balance, P&L, balance sheet, cash and bank books, cost centres, multi-currency with PKR base. Money is NUMERIC only. Build fast keyboard-first voucher entry. Add `report.footer_banner` and `empty_state.suggestion` ad slots where allowed. Add tests proving debits equal credits, period locks, immutability and tenant isolation."

**Gate:** a sample company's books balance end to end; reports match hand-computed totals.

### Phase 3: Sales, inventory, FBR Digital Invoicing

**Prompt:** "Build customers, items with units and variants, price lists, quotations, sales orders, delivery, sales invoices, credit notes, POS-lite, warehouses, stock movements, valuation (weighted average, optionally FIFO), reorder alerts, and batch/serial tracking. Post sales and stock to accounting through events. Implement FBR Digital Invoicing behind an adapter interface with a sandbox/mock first; use only field names from the official specification I provide, and ask me for it if missing. Store FBR submission status, invoice number and QR data, with retry and an audit trail. Printable invoices have no ads."

**Gate:** sale to stock to ledger flow reconciles; FBR adapter passes mock tests; nothing about tax rates hard-coded.

### Phase 4: Purchase, AR/AP, banking

**Prompt:** "Build suppliers, purchase requisitions, orders, goods receipt, bills, debit notes, landed cost, AR/AP ageing, settlement and allocation, withholding tax with configurable effective-dated rates, bank accounts, statement import (CSV), reconciliation with suggested matches, and payment batches. Integrate with approvals and accounting."

**Gate:** ageing reports tie to the ledger; reconciliation closes to zero on test data.

### Phase 5: HR, attendance, payroll

**Prompt:** "Build employees, departments, designations, shifts, attendance (manual, import, simple mobile check-in), leave policies and balances, loans and advances, and payroll with configurable, effective-dated statutory rules (income tax slabs, EOBI, social security, provident fund). Generate payslips and payroll journal entries. I will supply current rates; until then use clearly marked sample values in seed data, not in code."

**Gate:** payroll recalculation is deterministic and auditable; salary data protected by dedicated permissions; zero ads on HR screens.

### Phase 6: Fixed assets and expenses

**Prompt:** "Build asset register, categories, depreciation methods and schedules with auto-posting, disposal, and employee expense claims with receipts and approvals, petty cash, and recurring expenses."

### Phase 7: Projects, CRM, network/IT services

**Prompt:** "Build CRM (leads, pipeline kanban, activities, quotes to sales orders), projects (tasks, timesheets, budgets, billing milestones), and service desk (tickets, SLAs, assets under contract, recurring service invoicing, site visits)."

### Phase 8: Distribution, BI, subscription billing, hardening

**Prompt:** "Build distribution (routes, van sales, trade schemes), BI dashboards with drill-down and scheduled email reports, the full subscription billing described in 2.5, and a hardening pass: security review (OWASP ASVS checklist), rate limits, backup and restore scripts, data export per tenant, error monitoring hooks, load testing, accessibility audit, and an updated VPS migration guide (Nginx, PM2)."

**Gate:** security checklist signed off, restore from backup tested, performance targets met.

---

## Part 4: Standing rules to give Antigravity (save as workspace rules)

```
1. Read before writing. Reuse existing helpers (withTenant, writeAudit, nextDocNumber) instead of new patterns.
2. Every table: tenant_id, ENABLE + FORCE RLS, tenant_isolation policy, isolation test.
3. Every route: Zod validation, permission gate, consistent error format, audit entry for mutations.
4. Money is NUMERIC / decimal strings end to end. No floating point in money paths.
5. No hard-coded statutory values. No guessed FBR fields.
6. No native npm add-ons. Keep memory low (DB pool max 5 to 10).
7. Every screen: loading, empty, error and success states; keyboard accessible; Urdu/RTL checked.
8. Ads: only through <AdSlot>, never on sensitive screens, never in print/PDF, never using tenant business data.
9. Verify with real runs (tests, browser agent). State plainly what was not verified.
10. Finish each phase with a Walkthrough artifact and updated docs.
```

---

## Part 5: Suggested timeline and milestones

| Stage | Phases | Indicative effort with agent assistance |
| --- | --- | --- |
| Foundation | 0, 1a, 1b, 1c | 3 to 5 weeks |
| Finance core | 2, 3 | 5 to 8 weeks |
| Operations | 4, 5, 6 | 6 to 9 weeks |
| Growth modules | 7, 8 | 5 to 8 weeks |

These are rough estimates; the verification gates, FBR specification access, and your review time will move them. Launch a paid beta after Phase 3 (Accounting, Sales, Inventory, FBR) because that is the most valuable bundle for Pakistani SMEs, and switch ads on at that point once you have enough active free-plan tenants to sell placements.

---

## Part 6: Things you need to provide to the agent

- The official **FBR Digital Invoicing technical specification** and sandbox credentials.
- Current Pakistani **income tax slabs, EOBI, social security, withholding rates** (as seed data, effective-dated).
- Brand name, logo, color preferences and Urdu font choice.
- Your pricing and plan limits.
- A list of potential advertisers or ad categories (banks, couriers, ISPs, hardware) so the house-ad and sponsor templates fit.
- A PostgreSQL database for tests (throwaway) and a staging environment.

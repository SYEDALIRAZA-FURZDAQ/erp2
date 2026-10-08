-- Phase 2 to 7 Business Modules Schema
-- Covers:
-- 1. Accounting: Chart of Accounts, Journal Entries & Lines
-- 2. Sales & FBR Digital Invoicing: Customers, Invoices, Items
-- 3. Inventory: Warehouses, Items, Stock Movements
-- 4. Purchase: Vendors, Bills, Bill Items
-- 5. HR & Payroll: Employees, Payroll Runs, Payslips
-- 6. Attendance: Attendance Logs, Leave Requests
-- 7. Fixed Assets: Asset Register, Depreciation Logs
-- 8. Projects: Projects, Tasks, Timesheets

-- ===============================================================
-- 1. ACCOUNTING MODULE
-- ===============================================================
CREATE TABLE accounts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  code        text NOT NULL,
  name        text NOT NULL,
  type        text NOT NULL CHECK (type IN ('asset', 'liability', 'equity', 'revenue', 'expense')),
  subtype     text,
  parent_id   uuid REFERENCES accounts(id),
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code)
);
CREATE INDEX accounts_tenant_idx ON accounts(tenant_id);

CREATE TABLE journal_entries (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  entry_number  text NOT NULL,
  entry_date    date NOT NULL DEFAULT CURRENT_DATE,
  voucher_type  text NOT NULL DEFAULT 'JV' CHECK (voucher_type IN ('JV', 'CV', 'BV', 'SI', 'PI')),
  narration     text,
  reference     text,
  is_posted     boolean NOT NULL DEFAULT true,
  created_by    uuid REFERENCES users(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, entry_number)
);
CREATE INDEX journal_entries_tenant_date_idx ON journal_entries(tenant_id, entry_date DESC);

CREATE TABLE journal_entry_lines (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id),
  entry_id     uuid NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_id   uuid NOT NULL REFERENCES accounts(id),
  debit        numeric(14,2) NOT NULL DEFAULT 0 CHECK (debit >= 0),
  credit       numeric(14,2) NOT NULL DEFAULT 0 CHECK (credit >= 0),
  description  text,
  line_number  integer NOT NULL DEFAULT 1
);
CREATE INDEX journal_lines_tenant_entry_idx ON journal_entry_lines(tenant_id, entry_id);
CREATE INDEX journal_lines_tenant_account_idx ON journal_entry_lines(tenant_id, account_id);

-- ===============================================================
-- 2. SALES & FBR DIGITAL INVOICING MODULE
-- ===============================================================
CREATE TABLE customers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  name        text NOT NULL,
  ntn         text,
  strn        text,
  cnic        text,
  phone       text,
  email       text,
  address     text,
  city        text,
  buyer_type  text NOT NULL DEFAULT 'unregistered' CHECK (buyer_type IN ('registered', 'unregistered', 'corporate', 'individual')),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX customers_tenant_idx ON customers(tenant_id);

CREATE TABLE sales_invoices (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid NOT NULL REFERENCES tenants(id),
  invoice_number     text NOT NULL,
  customer_id        uuid NOT NULL REFERENCES customers(id),
  invoice_date       date NOT NULL DEFAULT CURRENT_DATE,
  due_date           date,
  status             text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'posted', 'paid', 'cancelled')),
  subtotal           numeric(14,2) NOT NULL DEFAULT 0,
  discount           numeric(14,2) NOT NULL DEFAULT 0,
  sales_tax          numeric(14,2) NOT NULL DEFAULT 0,
  pos_fee            numeric(14,2) NOT NULL DEFAULT 1.00,
  grand_total        numeric(14,2) NOT NULL DEFAULT 0,
  notes              text,
  -- FBR Digital Invoicing Integration fields
  fbr_invoice_number text,
  fbr_status         text NOT NULL DEFAULT 'pending' CHECK (fbr_status IN ('pending', 'reported', 'failed', 'exempt')),
  fbr_qr_code        text,
  fbr_response       jsonb,
  reported_at        timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, invoice_number)
);
CREATE INDEX sales_invoices_tenant_idx ON sales_invoices(tenant_id, invoice_date DESC);
CREATE INDEX sales_invoices_customer_idx ON sales_invoices(customer_id);

CREATE TABLE sales_invoice_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id),
  invoice_id   uuid NOT NULL REFERENCES sales_invoices(id) ON DELETE CASCADE,
  item_id      uuid,
  description  text NOT NULL,
  quantity     numeric(12,2) NOT NULL CHECK (quantity > 0),
  unit_price   numeric(14,2) NOT NULL CHECK (unit_price >= 0),
  tax_rate     numeric(5,2) NOT NULL DEFAULT 18.00,
  tax_amount   numeric(14,2) NOT NULL DEFAULT 0,
  total        numeric(14,2) NOT NULL DEFAULT 0
);
CREATE INDEX sales_items_invoice_idx ON sales_invoice_items(invoice_id);

-- ===============================================================
-- 3. INVENTORY MODULE
-- ===============================================================
CREATE TABLE warehouses (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  code        text NOT NULL,
  name        text NOT NULL,
  address     text,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code)
);
CREATE INDEX warehouses_tenant_idx ON warehouses(tenant_id);

CREATE TABLE items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  sku           text NOT NULL,
  name          text NOT NULL,
  category      text,
  uom           text NOT NULL DEFAULT 'pcs',
  cost_price    numeric(14,2) NOT NULL DEFAULT 0 CHECK (cost_price >= 0),
  selling_price numeric(14,2) NOT NULL DEFAULT 0 CHECK (selling_price >= 0),
  tax_rate      numeric(5,2) NOT NULL DEFAULT 18.00,
  reorder_level numeric(12,2) NOT NULL DEFAULT 10,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, sku)
);
CREATE INDEX items_tenant_idx ON items(tenant_id);

CREATE TABLE stock_movements (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES tenants(id),
  item_id        uuid NOT NULL REFERENCES items(id),
  warehouse_id   uuid NOT NULL REFERENCES warehouses(id),
  movement_type  text NOT NULL CHECK (movement_type IN ('in', 'out', 'adjustment', 'transfer')),
  quantity       numeric(12,2) NOT NULL,
  unit_cost      numeric(14,2) NOT NULL DEFAULT 0,
  reference      text,
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX stock_movements_tenant_item_idx ON stock_movements(tenant_id, item_id);
CREATE INDEX stock_movements_warehouse_idx ON stock_movements(warehouse_id);

-- Link sales_invoice_items to items
ALTER TABLE sales_invoice_items ADD CONSTRAINT fk_sales_item FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE SET NULL;

-- ===============================================================
-- 4. PURCHASE MODULE
-- ===============================================================
CREATE TABLE vendors (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id),
  name            text NOT NULL,
  ntn             text,
  strn            text,
  contact_person  text,
  phone           text,
  email           text,
  address         text,
  city            text,
  payment_terms   text,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX vendors_tenant_idx ON vendors(tenant_id);

CREATE TABLE purchase_bills (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  bill_number   text NOT NULL,
  vendor_id     uuid NOT NULL REFERENCES vendors(id),
  warehouse_id  uuid REFERENCES warehouses(id),
  bill_date     date NOT NULL DEFAULT CURRENT_DATE,
  due_date      date,
  status        text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'received', 'paid', 'cancelled')),
  subtotal      numeric(14,2) NOT NULL DEFAULT 0,
  tax_amount    numeric(14,2) NOT NULL DEFAULT 0,
  grand_total   numeric(14,2) NOT NULL DEFAULT 0,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, bill_number)
);
CREATE INDEX purchase_bills_tenant_idx ON purchase_bills(tenant_id, bill_date DESC);
CREATE INDEX purchase_bills_vendor_idx ON purchase_bills(vendor_id);

CREATE TABLE purchase_bill_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id),
  bill_id      uuid NOT NULL REFERENCES purchase_bills(id) ON DELETE CASCADE,
  item_id      uuid REFERENCES items(id) ON DELETE SET NULL,
  description  text NOT NULL,
  quantity     numeric(12,2) NOT NULL CHECK (quantity > 0),
  unit_cost    numeric(14,2) NOT NULL CHECK (unit_cost >= 0),
  tax_rate     numeric(5,2) NOT NULL DEFAULT 0,
  tax_amount   numeric(14,2) NOT NULL DEFAULT 0,
  total        numeric(14,2) NOT NULL DEFAULT 0
);
CREATE INDEX purchase_items_bill_idx ON purchase_bill_items(bill_id);

-- ===============================================================
-- 5. HR & PAYROLL MODULE
-- ===============================================================
CREATE TABLE employees (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL REFERENCES tenants(id),
  employee_code         text NOT NULL,
  full_name             text NOT NULL,
  cnic                  text NOT NULL,
  email                 text,
  phone                 text,
  department            text NOT NULL,
  designation           text NOT NULL,
  joining_date          date NOT NULL,
  basic_salary          numeric(14,2) NOT NULL DEFAULT 0 CHECK (basic_salary >= 0),
  medical_allowance     numeric(14,2) NOT NULL DEFAULT 0 CHECK (medical_allowance >= 0),
  conveyance_allowance  numeric(14,2) NOT NULL DEFAULT 0 CHECK (conveyance_allowance >= 0),
  bank_account          text,
  status                text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'on_leave', 'terminated', 'resigned')),
  created_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, employee_code)
);
CREATE INDEX employees_tenant_idx ON employees(tenant_id);

CREATE TABLE payroll_runs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  run_number    text NOT NULL,
  month         smallint NOT NULL CHECK (month BETWEEN 1 AND 12),
  year          smallint NOT NULL CHECK (year >= 2020),
  status        text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'paid')),
  total_gross   numeric(14,2) NOT NULL DEFAULT 0,
  total_tax     numeric(14,2) NOT NULL DEFAULT 0,
  total_eobi    numeric(14,2) NOT NULL DEFAULT 0,
  total_net     numeric(14,2) NOT NULL DEFAULT 0,
  payment_date  date,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, month, year)
);
CREATE INDEX payroll_runs_tenant_idx ON payroll_runs(tenant_id, year DESC, month DESC);

CREATE TABLE payslips (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES tenants(id),
  payroll_run_id    uuid NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
  employee_id       uuid NOT NULL REFERENCES employees(id),
  basic_salary      numeric(14,2) NOT NULL DEFAULT 0,
  allowances        numeric(14,2) NOT NULL DEFAULT 0,
  gross_salary      numeric(14,2) NOT NULL DEFAULT 0,
  income_tax        numeric(14,2) NOT NULL DEFAULT 0,
  eobi_deduction    numeric(14,2) NOT NULL DEFAULT 0,
  other_deductions  numeric(14,2) NOT NULL DEFAULT 0,
  net_salary        numeric(14,2) NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX payslips_tenant_run_idx ON payslips(tenant_id, payroll_run_id);
CREATE INDEX payslips_employee_idx ON payslips(employee_id);

-- ===============================================================
-- 6. ATTENDANCE MODULE
-- ===============================================================
CREATE TABLE attendance (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id),
  employee_id  uuid NOT NULL REFERENCES employees(id),
  date         date NOT NULL DEFAULT CURRENT_DATE,
  check_in     time,
  check_out    time,
  status       text NOT NULL DEFAULT 'present' CHECK (status IN ('present', 'absent', 'late', 'half_day', 'on_leave')),
  remarks      text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, employee_id, date)
);
CREATE INDEX attendance_tenant_date_idx ON attendance(tenant_id, date DESC);

CREATE TABLE leave_requests (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id),
  employee_id  uuid NOT NULL REFERENCES employees(id),
  leave_type   text NOT NULL CHECK (leave_type IN ('annual', 'casual', 'sick', 'unpaid')),
  start_date   date NOT NULL,
  end_date     date NOT NULL CHECK (end_date >= start_date),
  reason       text NOT NULL,
  status       text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX leave_requests_tenant_idx ON leave_requests(tenant_id);

-- ===============================================================
-- 7. FIXED ASSETS MODULE
-- ===============================================================
CREATE TABLE fixed_assets (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                 uuid NOT NULL REFERENCES tenants(id),
  asset_code                text NOT NULL,
  name                      text NOT NULL,
  category                  text NOT NULL CHECK (category IN ('vehicles', 'it_equipment', 'machinery', 'furniture', 'building', 'other')),
  purchase_date             date NOT NULL,
  purchase_cost             numeric(14,2) NOT NULL CHECK (purchase_cost >= 0),
  salvage_value             numeric(14,2) NOT NULL DEFAULT 0 CHECK (salvage_value >= 0),
  useful_life_years         numeric(5,2) NOT NULL CHECK (useful_life_years > 0),
  depreciation_method       text NOT NULL DEFAULT 'straight_line',
  accumulated_depreciation  numeric(14,2) NOT NULL DEFAULT 0,
  current_value             numeric(14,2) NOT NULL DEFAULT 0,
  location                  text,
  status                    text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disposed', 'under_maintenance', 'written_off')),
  created_at                timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, asset_code)
);
CREATE INDEX fixed_assets_tenant_idx ON fixed_assets(tenant_id);

CREATE TABLE asset_depreciation_logs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id),
  asset_id     uuid NOT NULL REFERENCES fixed_assets(id) ON DELETE CASCADE,
  period_date  date NOT NULL,
  amount       numeric(14,2) NOT NULL CHECK (amount > 0),
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX asset_depreciation_logs_tenant_idx ON asset_depreciation_logs(tenant_id, asset_id);

-- ===============================================================
-- 8. PROJECTS MODULE
-- ===============================================================
CREATE TABLE projects (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES tenants(id),
  code              text NOT NULL,
  name              text NOT NULL,
  client_id         uuid REFERENCES customers(id) ON DELETE SET NULL,
  start_date        date NOT NULL,
  end_date          date,
  budget            numeric(14,2) NOT NULL DEFAULT 0,
  status            text NOT NULL DEFAULT 'planning' CHECK (status IN ('planning', 'in_progress', 'on_hold', 'completed', 'cancelled')),
  priority          text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  progress_percent  smallint NOT NULL DEFAULT 0 CHECK (progress_percent BETWEEN 0 AND 100),
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code)
);
CREATE INDEX projects_tenant_idx ON projects(tenant_id);

CREATE TABLE project_tasks (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id),
  project_id   uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title        text NOT NULL,
  assigned_to  uuid REFERENCES employees(id) ON DELETE SET NULL,
  due_date     date,
  status       text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'review', 'done')),
  priority     text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX project_tasks_tenant_project_idx ON project_tasks(tenant_id, project_id);

CREATE TABLE project_timesheets (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id),
  project_id      uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  employee_id     uuid REFERENCES employees(id) ON DELETE SET NULL,
  date            date NOT NULL DEFAULT CURRENT_DATE,
  hours           numeric(5,2) NOT NULL CHECK (hours > 0),
  expense_amount  numeric(14,2) NOT NULL DEFAULT 0,
  description     text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX project_timesheets_tenant_project_idx ON project_timesheets(tenant_id, project_id);

-- ===============================================================
-- RLS POLICIES FOR ALL NEW TABLES
-- ===============================================================
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'accounts','journal_entries','journal_entry_lines',
    'customers','sales_invoices','sales_invoice_items',
    'warehouses','items','stock_movements',
    'vendors','purchase_bills','purchase_bill_items',
    'employees','payroll_runs','payslips',
    'attendance','leave_requests',
    'fixed_assets','asset_depreciation_logs',
    'projects','project_tasks','project_timesheets'
  ]) LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (tenant_id = nullif(current_setting(''app.tenant_id'', true), '''')::uuid) WITH CHECK (tenant_id = nullif(current_setting(''app.tenant_id'', true), '''')::uuid)',
      t);
  END LOOP;
END $$;

-- ===============================================================
-- SEED DEFAULT NUMBER SERIES FOR EXISTING TENANTS
-- ===============================================================
INSERT INTO number_series (tenant_id, doc_type, prefix)
SELECT t.id, s.doc_type, s.prefix
FROM tenants t
CROSS JOIN (
  VALUES
    ('journal_voucher', 'JV-'),
    ('sales_invoice', 'SI-'),
    ('purchase_bill', 'BILL-'),
    ('purchase_order', 'PO-'),
    ('employee', 'EMP-'),
    ('fixed_asset', 'AST-'),
    ('project', 'PRJ-'),
    ('payroll_run', 'PR-')
) AS s(doc_type, prefix)
ON CONFLICT (tenant_id, doc_type, fiscal_year) DO NOTHING;

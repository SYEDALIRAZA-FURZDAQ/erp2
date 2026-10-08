-- Migration 004: Payroll lifecycle statuses (approve/decline/reverse), decline tracking, and EOBI liability account

-- 1. Extend payroll_runs status check to allow 'declined' and 'reversed'
ALTER TABLE payroll_runs DROP CONSTRAINT IF EXISTS payroll_runs_status_check;
ALTER TABLE payroll_runs ADD CONSTRAINT payroll_runs_status_check CHECK (status IN ('draft', 'approved', 'paid', 'declined', 'reversed'));

-- 2. Add decline metadata columns to payroll_runs
ALTER TABLE payroll_runs
  ADD COLUMN IF NOT EXISTS declined_at timestamptz,
  ADD COLUMN IF NOT EXISTS declined_by uuid REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS decline_reason text;

-- 3. Ensure EOBI & Social Security Payable account (code 2040) exists for all existing tenants
INSERT INTO accounts (tenant_id, code, name, type, subtype)
SELECT id, '2040', 'EOBI & Social Security Payable', 'liability', 'current_liability'
FROM tenants
ON CONFLICT (tenant_id, code) DO NOTHING;

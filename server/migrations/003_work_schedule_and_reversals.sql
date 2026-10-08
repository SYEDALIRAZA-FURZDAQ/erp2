-- Migration 003: Company work schedule / working days settings and transaction reversals

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS working_days text[] NOT NULL DEFAULT '{"monday","tuesday","wednesday","thursday","friday"}',
  ADD COLUMN IF NOT EXISTS saturday_rule text NOT NULL DEFAULT 'off',
  ADD COLUMN IF NOT EXISTS work_start_time text NOT NULL DEFAULT '09:00',
  ADD COLUMN IF NOT EXISTS work_end_time text NOT NULL DEFAULT '18:00',
  ADD COLUMN IF NOT EXISTS late_grace_minutes integer NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS half_day_hours numeric(3,1) NOT NULL DEFAULT 4.0;

ALTER TABLE payroll_runs
  ADD COLUMN IF NOT EXISTS reversed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reversed_by uuid REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS reversal_reason text;

ALTER TABLE journal_entries
  ADD COLUMN IF NOT EXISTS reversed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reversed_by uuid REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS reversal_reason text;

-- Core platform schema: tenants, companies, users, RBAC, sessions, audit, numbering.
-- Every business table carries tenant_id and is protected by Row-Level Security.
-- Requires PostgreSQL 13+ (gen_random_uuid is built in).

CREATE TABLE tenants (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'),
  name        text NOT NULL,
  status      text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','cancelled')),
  plan        text NOT NULL DEFAULT 'trial',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE companies (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid NOT NULL REFERENCES tenants(id),
  name               text NOT NULL,
  legal_name         text,
  ntn                text,
  strn               text,
  cnic               text,
  address            text,
  city               text,
  province           text,
  phone              text,
  email              text,
  base_currency      char(3) NOT NULL DEFAULT 'PKR',
  fiscal_year_start_month smallint NOT NULL DEFAULT 7 CHECK (fiscal_year_start_month BETWEEN 1 AND 12),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX companies_tenant_idx ON companies(tenant_id);

CREATE TABLE branches (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  company_id  uuid NOT NULL REFERENCES companies(id),
  code        text NOT NULL,
  name        text NOT NULL,
  address     text,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code)
);
CREATE INDEX branches_company_idx ON branches(company_id);

CREATE TABLE users (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES tenants(id),
  email            text NOT NULL,
  password_hash    text NOT NULL,
  full_name        text NOT NULL,
  is_active        boolean NOT NULL DEFAULT true,
  is_owner         boolean NOT NULL DEFAULT false,
  failed_attempts  integer NOT NULL DEFAULT 0,
  locked_until     timestamptz,
  last_login_at    timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_tenant_email_uq ON users(tenant_id, lower(email));

CREATE TABLE roles (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id),
  name         text NOT NULL,
  description  text,
  is_system    boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

CREATE TABLE role_permissions (
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  role_id     uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission  text NOT NULL,
  PRIMARY KEY (role_id, permission)
);
CREATE INDEX role_permissions_tenant_idx ON role_permissions(tenant_id);

CREATE TABLE user_roles (
  tenant_id  uuid NOT NULL REFERENCES tenants(id),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id    uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);
CREATE INDEX user_roles_tenant_idx ON user_roles(tenant_id);
CREATE INDEX user_roles_role_idx ON user_roles(role_id);

CREATE TABLE refresh_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  text NOT NULL UNIQUE,
  expires_at  timestamptz NOT NULL,
  revoked_at  timestamptz,
  user_agent  text,
  ip          text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX refresh_tokens_user_idx ON refresh_tokens(user_id);

CREATE TABLE audit_log (
  id          bigserial PRIMARY KEY,
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  user_id     uuid,
  action      text NOT NULL,
  entity      text NOT NULL,
  entity_id   text,
  old_value   jsonb,
  new_value   jsonb,
  ip          text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_tenant_created_idx ON audit_log(tenant_id, created_at DESC);
CREATE INDEX audit_tenant_entity_idx ON audit_log(tenant_id, entity, entity_id);

-- Document numbering: one row per (tenant, document type, fiscal year label).
-- Allocation uses a row lock inside the posting transaction, so numbers are gap-free
-- (a rolled back transaction rolls back its number too).
CREATE TABLE number_series (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id),
  doc_type     text NOT NULL,
  fiscal_year  text NOT NULL DEFAULT '',
  prefix       text NOT NULL DEFAULT '',
  padding      smallint NOT NULL DEFAULT 5 CHECK (padding BETWEEN 1 AND 12),
  next_number  bigint NOT NULL DEFAULT 1 CHECK (next_number >= 1),
  UNIQUE (tenant_id, doc_type, fiscal_year)
);

-- Fiscal years and period locking (used by the accounting module in Phase 2)
CREATE TABLE fiscal_periods (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  company_id  uuid NOT NULL REFERENCES companies(id),
  label       text NOT NULL,
  start_date  date NOT NULL,
  end_date    date NOT NULL CHECK (end_date >= start_date),
  is_closed   boolean NOT NULL DEFAULT false,
  UNIQUE (tenant_id, company_id, label)
);

-- ---------------------------------------------------------------
-- Row-Level Security. FORCE is required because on cPanel the app's
-- DB user is the table owner, and owners bypass RLS unless forced.
-- The app sets: SELECT set_config('app.tenant_id', '<uuid>', true) per transaction.
-- If it is unset, current_setting(..., true) is NULL and no rows match (fail closed).
-- ---------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'companies','branches','users','roles','role_permissions','user_roles',
    'refresh_tokens','audit_log','number_series','fiscal_periods'
  ]) LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (tenant_id = nullif(current_setting(''app.tenant_id'', true), '''')::uuid) WITH CHECK (tenant_id = nullif(current_setting(''app.tenant_id'', true), '''')::uuid)',
      t);
  END LOOP;
END $$;

-- Audit log is append-only for the application.
CREATE OR REPLACE FUNCTION audit_log_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only';
END $$ LANGUAGE plpgsql;
CREATE TRIGGER audit_log_no_update BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();

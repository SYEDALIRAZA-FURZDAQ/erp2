import { Db } from '../../db/pool';

export interface AuditEntry {
  tenantId: string;
  userId?: string | null;
  action: string; // e.g. user.create
  entity: string; // e.g. user
  entityId?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  ip?: string | null;
}

const SENSITIVE = new Set(['password', 'password_hash', 'passwordHash', 'token']);

function scrub(value: unknown): unknown {
  if (value === undefined || value === null) return null;
  return JSON.parse(JSON.stringify(value, (k, v) => (SENSITIVE.has(k) ? '[redacted]' : v)));
}

/** Call inside the same transaction as the change so audit and data commit together. */
export async function writeAudit(db: Db, e: AuditEntry): Promise<void> {
  await db.query(
    `INSERT INTO audit_log (tenant_id, user_id, action, entity, entity_id, old_value, new_value, ip)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [e.tenantId, e.userId ?? null, e.action, e.entity, e.entityId ?? null, scrub(e.oldValue), scrub(e.newValue), e.ip ?? null],
  );
}

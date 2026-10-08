import { z } from 'zod';
import { env } from '../../config/env';
import { pool, withTenant } from '../../db/pool';
import { conflict, forbidden, unauthorized } from '../../utils/errors';
import { hashPassword, randomToken, sha256, verifyPassword } from '../../utils/password';
import { signAccessToken, loadPermissions } from '../../middleware/auth';
import { writeAudit } from '../audit/audit.service';
import { PERMISSIONS, SYSTEM_ROLES } from '../roles/permissions';
import { DEFAULT_SERIES } from '../numbering/numbering.service';

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128)
  .regex(/[A-Za-z]/, 'Password needs a letter')
  .regex(/[0-9]/, 'Password needs a number');

export const registerSchema = z.object({
  companyName: z.string().trim().min(2).max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/, 'Use 3-40 lowercase letters, numbers or hyphens'),
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email(),
  password: passwordSchema,
});

export const loginSchema = z.object({
  tenant: z.string().trim().toLowerCase().min(1),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

interface SessionMeta {
  ip?: string | null;
  userAgent?: string | null;
}

export async function registerTenant(input: z.infer<typeof registerSchema>, meta: SessionMeta) {
  if (!env.ALLOW_TENANT_SIGNUP) throw forbidden('Sign-up is disabled. Contact the administrator.');
  const passwordHash = await hashPassword(input.password);

  let tenantId: string;
  try {
    const t = await pool.query('INSERT INTO tenants (slug, name) VALUES ($1,$2) RETURNING id', [
      input.slug,
      input.companyName,
    ]);
    tenantId = t.rows[0].id;
  } catch (e) {
    if ((e as { code?: string }).code === '23505') throw conflict('That company code is already taken');
    throw e;
  }

  try {
    await withTenant(tenantId, async (db) => {
      await db.query('INSERT INTO companies (tenant_id, name) VALUES ($1,$2)', [tenantId, input.companyName]);

      const roleIds: Record<string, string> = {};
      for (const role of SYSTEM_ROLES) {
        const r = await db.query(
          'INSERT INTO roles (tenant_id, name, description, is_system) VALUES ($1,$2,$3,true) RETURNING id',
          [tenantId, role.name, role.description],
        );
        roleIds[role.name] = r.rows[0].id;
        for (const perm of role.permissions) {
          await db.query('INSERT INTO role_permissions (tenant_id, role_id, permission) VALUES ($1,$2,$3)', [
            tenantId,
            r.rows[0].id,
            perm,
          ]);
        }
      }

      const u = await db.query(
        `INSERT INTO users (tenant_id, email, password_hash, full_name, is_owner)
         VALUES ($1,$2,$3,$4,true) RETURNING id`,
        [tenantId, input.email, passwordHash, input.fullName],
      );
      await db.query('INSERT INTO user_roles (tenant_id, user_id, role_id) VALUES ($1,$2,$3)', [
        tenantId,
        u.rows[0].id,
        roleIds['Owner'],
      ]);

      for (const s of DEFAULT_SERIES) {
        await db.query('INSERT INTO number_series (tenant_id, doc_type, prefix) VALUES ($1,$2,$3)', [
          tenantId,
          s.docType,
          s.prefix,
        ]);
      }

      await writeAudit(db, {
        tenantId,
        userId: u.rows[0].id,
        action: 'tenant.register',
        entity: 'tenant',
        entityId: tenantId,
        newValue: { slug: input.slug, name: input.companyName, owner: input.email },
        ip: meta.ip,
      });
    });
  } catch (e) {
    // Provisioning failed half way: remove the empty tenant shell so the code can be reused.
    await withTenant(tenantId, async (db) => {
      for (const t of ['number_series', 'user_roles', 'role_permissions', 'users', 'roles', 'companies']) {
        await db.query(`DELETE FROM ${t}`);
      }
    }).catch(() => undefined);
    await pool.query('DELETE FROM tenants WHERE id = $1', [tenantId]).catch(() => undefined);
    throw e;
  }

  return { tenantId, slug: input.slug };
}

async function issueRefreshToken(tenantId: string, userId: string, meta: SessionMeta) {
  const raw = randomToken();
  const expires = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86_400_000);
  await withTenant(tenantId, (db) =>
    db.query(
      `INSERT INTO refresh_tokens (tenant_id, user_id, token_hash, expires_at, user_agent, ip)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [tenantId, userId, sha256(raw), expires, meta.userAgent?.slice(0, 255) ?? null, meta.ip ?? null],
    ),
  );
  return { cookieValue: `${tenantId}.${raw}`, expires };
}

async function buildSession(tenantId: string, userId: string) {
  const loaded = await loadPermissions(tenantId, userId);
  if (!loaded) throw unauthorized('Account is disabled');
  const info = await withTenant(tenantId, async (db) => {
    const u = await db.query('SELECT id, email, full_name FROM users WHERE id = $1', [userId]);
    const t = await pool.query('SELECT slug, name FROM tenants WHERE id = $1', [tenantId]);
    return { user: u.rows[0], tenant: t.rows[0] };
  });
  return {
    accessToken: signAccessToken(userId, tenantId),
    user: {
      id: info.user.id,
      email: info.user.email,
      fullName: info.user.full_name,
      isOwner: loaded.isOwner,
      permissions: loaded.permissions,
    },
    tenant: { id: tenantId, slug: info.tenant.slug, name: info.tenant.name },
  };
}

export async function login(input: z.infer<typeof loginSchema>, meta: SessionMeta) {
  const bad = unauthorized('Invalid company code, email or password');
  const t = await pool.query('SELECT id, status FROM tenants WHERE slug = $1', [input.tenant]);
  if (!t.rows[0]) {
    await hashPassword(input.password); // equalise timing
    throw bad;
  }
  if (t.rows[0].status !== 'active') throw forbidden('This account is suspended');
  const tenantId: string = t.rows[0].id;

  const userId = await withTenant(tenantId, async (db) => {
    const r = await db.query(
      'SELECT id, password_hash, is_active, failed_attempts, locked_until FROM users WHERE lower(email) = $1',
      [input.email],
    );
    const u = r.rows[0];
    if (!u) {
      await hashPassword(input.password);
      return null;
    }
    if (u.locked_until && new Date(u.locked_until) > new Date()) {
      throw forbidden('Too many failed attempts. Try again in a few minutes.');
    }
    const ok = await verifyPassword(input.password, u.password_hash);
    if (!ok || !u.is_active) {
      const attempts = u.failed_attempts + 1;
      const lock = attempts >= MAX_FAILED ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null;
      await db.query('UPDATE users SET failed_attempts = $2, locked_until = $3 WHERE id = $1', [
        u.id,
        lock ? 0 : attempts,
        lock,
      ]);
      await writeAudit(db, { tenantId, userId: u.id, action: 'auth.login_failed', entity: 'user', entityId: u.id, ip: meta.ip });
      return null;
    }
    await db.query('UPDATE users SET failed_attempts = 0, locked_until = NULL, last_login_at = now() WHERE id = $1', [u.id]);
    await writeAudit(db, { tenantId, userId: u.id, action: 'auth.login', entity: 'user', entityId: u.id, ip: meta.ip });
    return u.id as string;
  });
  if (!userId) throw bad;

  const refresh = await issueRefreshToken(tenantId, userId, meta);
  return { session: await buildSession(tenantId, userId), refresh };
}

function parseCookie(value: string | undefined) {
  if (!value) return null;
  const i = value.indexOf('.');
  if (i < 1) return null;
  return { tenantId: value.slice(0, i), raw: value.slice(i + 1) };
}

/** Rotating refresh tokens. Reuse of a revoked token revokes every session of that user. */
export async function refresh(cookie: string | undefined, meta: SessionMeta) {
  const parsed = parseCookie(cookie);
  if (!parsed || !/^[0-9a-f-]{36}$/.test(parsed.tenantId)) throw unauthorized();
  const { tenantId } = parsed;

  const userId = await withTenant(tenantId, async (db) => {
    const r = await db.query('SELECT id, user_id, expires_at, revoked_at FROM refresh_tokens WHERE token_hash = $1', [
      sha256(parsed.raw),
    ]);
    const t = r.rows[0];
    if (!t) return null;
    if (t.revoked_at) {
      await db.query('UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [t.user_id]);
      return null;
    }
    if (new Date(t.expires_at) < new Date()) return null;
    await db.query('UPDATE refresh_tokens SET revoked_at = now() WHERE id = $1', [t.id]);
    return t.user_id as string;
  });
  if (!userId) throw unauthorized();

  const next = await issueRefreshToken(tenantId, userId, meta);
  return { session: await buildSession(tenantId, userId), refresh: next };
}

export async function logout(cookie: string | undefined) {
  const parsed = parseCookie(cookie);
  if (!parsed || !/^[0-9a-f-]{36}$/.test(parsed.tenantId)) return;
  await withTenant(parsed.tenantId, (db) =>
    db.query('UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL', [
      sha256(parsed.raw),
    ]),
  );
}

export async function me(tenantId: string, userId: string) {
  return buildSession(tenantId, userId);
}

export const ALL_PERMISSIONS = PERMISSIONS;

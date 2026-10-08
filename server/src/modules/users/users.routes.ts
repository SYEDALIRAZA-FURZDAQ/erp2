import { Router } from 'express';
import { z } from 'zod';
import { authenticate, clientIp, requirePermission } from '../../middleware/auth';
import { withTenant } from '../../db/pool';
import { asyncHandler, badRequest, notFound } from '../../utils/errors';
import { hashPassword } from '../../utils/password';
import { passwordSchema } from '../auth/auth.service';
import { writeAudit } from '../audit/audit.service';

export const usersRouter = Router();
usersRouter.use(authenticate);

const createSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  fullName: z.string().trim().min(2).max(120),
  password: passwordSchema,
  roleIds: z.array(z.string().uuid()).default([]),
});

const updateSchema = z.object({
  fullName: z.string().trim().min(2).max(120).optional(),
  isActive: z.boolean().optional(),
  roleIds: z.array(z.string().uuid()).optional(),
});

const listSchema = z.object({
  q: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

const USER_SELECT = `
  SELECT u.id, u.email, u.full_name AS "fullName", u.is_active AS "isActive", u.is_owner AS "isOwner",
         u.last_login_at AS "lastLoginAt", u.created_at AS "createdAt",
         COALESCE(json_agg(json_build_object('id', r.id, 'name', r.name)) FILTER (WHERE r.id IS NOT NULL), '[]') AS roles
    FROM users u
    LEFT JOIN user_roles ur ON ur.user_id = u.id
    LEFT JOIN roles r ON r.id = ur.role_id`;

usersRouter.get(
  '/',
  requirePermission('core.users.read'),
  asyncHandler(async (req, res) => {
    const { q, page, pageSize } = listSchema.parse(req.query);
    const out = await withTenant(req.auth!.tenantId, async (db) => {
      const like = q ? `%${q.replace(/[%_]/g, '\\$&')}%` : null;
      const where = like ? 'WHERE u.email ILIKE $1 OR u.full_name ILIKE $1' : '';
      const params: unknown[] = like ? [like] : [];
      const total = await db.query(`SELECT count(*)::int AS n FROM users u ${where}`, params);
      const rows = await db.query(
        `${USER_SELECT} ${where} GROUP BY u.id ORDER BY u.created_at DESC LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
        params,
      );
      return { items: rows.rows, total: total.rows[0].n, page, pageSize };
    });
    res.json(out);
  }),
);

async function assertRolesExist(db: import('../../db/pool').Db, roleIds: string[]) {
  if (!roleIds.length) return;
  const r = await db.query('SELECT count(*)::int AS n FROM roles WHERE id = ANY($1::uuid[])', [roleIds]);
  if (r.rows[0].n !== new Set(roleIds).size) throw badRequest('One or more roles do not exist');
}

usersRouter.post(
  '/',
  requirePermission('core.users.manage'),
  asyncHandler(async (req, res) => {
    const input = createSchema.parse(req.body);
    const { tenantId, userId } = req.auth!;
    const hash = await hashPassword(input.password);
    const created = await withTenant(tenantId, async (db) => {
      await assertRolesExist(db, input.roleIds);
      const u = await db.query(
        'INSERT INTO users (tenant_id, email, password_hash, full_name) VALUES ($1,$2,$3,$4) RETURNING id',
        [tenantId, input.email, hash, input.fullName],
      );
      const id = u.rows[0].id as string;
      for (const roleId of new Set(input.roleIds)) {
        await db.query('INSERT INTO user_roles (tenant_id, user_id, role_id) VALUES ($1,$2,$3)', [tenantId, id, roleId]);
      }
      await writeAudit(db, {
        tenantId, userId, action: 'user.create', entity: 'user', entityId: id,
        newValue: { email: input.email, fullName: input.fullName, roleIds: input.roleIds }, ip: clientIp(req),
      });
      return id;
    });
    res.status(201).json({ id: created });
  }),
);

usersRouter.patch(
  '/:id',
  requirePermission('core.users.manage'),
  asyncHandler(async (req, res) => {
    const id = z.string().uuid().parse(req.params.id);
    const input = updateSchema.parse(req.body);
    const { tenantId, userId } = req.auth!;
    await withTenant(tenantId, async (db) => {
      const cur = await db.query('SELECT full_name, is_active, is_owner FROM users WHERE id = $1 FOR UPDATE', [id]);
      if (!cur.rows[0]) throw notFound('User not found');
      if (cur.rows[0].is_owner && input.isActive === false) throw badRequest('The owner account cannot be deactivated');
      if (id === userId && input.isActive === false) throw badRequest('You cannot deactivate yourself');

      await db.query(
        `UPDATE users SET full_name = COALESCE($2, full_name), is_active = COALESCE($3, is_active), updated_at = now()
          WHERE id = $1`,
        [id, input.fullName ?? null, input.isActive ?? null],
      );
      if (input.isActive === false) {
        await db.query('UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [id]);
      }
      if (input.roleIds) {
        await assertRolesExist(db, input.roleIds);
        if (cur.rows[0].is_owner) {
          const owner = await db.query("SELECT id FROM roles WHERE name = 'Owner' AND is_system");
          if (!input.roleIds.includes(owner.rows[0].id)) throw badRequest('The owner must keep the Owner role');
        }
        await db.query('DELETE FROM user_roles WHERE user_id = $1', [id]);
        for (const roleId of new Set(input.roleIds)) {
          await db.query('INSERT INTO user_roles (tenant_id, user_id, role_id) VALUES ($1,$2,$3)', [tenantId, id, roleId]);
        }
      }
      await writeAudit(db, {
        tenantId, userId, action: 'user.update', entity: 'user', entityId: id,
        oldValue: { fullName: cur.rows[0].full_name, isActive: cur.rows[0].is_active }, newValue: input, ip: clientIp(req),
      });
    });
    res.json({ ok: true });
  }),
);

usersRouter.post(
  '/:id/reset-password',
  requirePermission('core.users.manage'),
  asyncHandler(async (req, res) => {
    const id = z.string().uuid().parse(req.params.id);
    const { password } = z.object({ password: passwordSchema }).parse(req.body);
    const { tenantId, userId } = req.auth!;
    const hash = await hashPassword(password);
    await withTenant(tenantId, async (db) => {
      const r = await db.query(
        'UPDATE users SET password_hash = $2, failed_attempts = 0, locked_until = NULL, updated_at = now() WHERE id = $1',
        [id, hash],
      );
      if (!r.rowCount) throw notFound('User not found');
      await db.query('UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [id]);
      await writeAudit(db, { tenantId, userId, action: 'user.reset_password', entity: 'user', entityId: id, ip: clientIp(req) });
    });
    res.json({ ok: true });
  }),
);

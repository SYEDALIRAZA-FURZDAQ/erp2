import { Router } from 'express';
import { z } from 'zod';
import { authenticate, clientIp, requirePermission } from '../../middleware/auth';
import { Db, withTenant } from '../../db/pool';
import { asyncHandler, badRequest, notFound } from '../../utils/errors';
import { writeAudit } from '../audit/audit.service';
import { PERMISSIONS, PERMISSION_KEYS } from './permissions';

export const rolesRouter = Router();
rolesRouter.use(authenticate);

const permList = z
  .array(z.string())
  .default([])
  .refine((l) => l.every((p) => PERMISSION_KEYS.has(p)), 'Unknown permission in list');

const bodySchema = z.object({
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(200).optional(),
  permissions: permList,
});

rolesRouter.get('/permissions', requirePermission('core.roles.read'), (_req, res) => {
  res.json(PERMISSIONS);
});

rolesRouter.get(
  '/',
  requirePermission('core.roles.read'),
  asyncHandler(async (req, res) => {
    const rows = await withTenant(req.auth!.tenantId, (db) =>
      db.query(`
        SELECT r.id, r.name, r.description, r.is_system AS "isSystem",
               COALESCE(array_agg(rp.permission ORDER BY rp.permission) FILTER (WHERE rp.permission IS NOT NULL), '{}') AS permissions,
               (SELECT count(*)::int FROM user_roles ur WHERE ur.role_id = r.id) AS "userCount"
          FROM roles r LEFT JOIN role_permissions rp ON rp.role_id = r.id
         GROUP BY r.id ORDER BY r.is_system DESC, r.name`),
    );
    res.json(rows.rows);
  }),
);

async function setPermissions(db: Db, tenantId: string, roleId: string, perms: string[]) {
  await db.query('DELETE FROM role_permissions WHERE role_id = $1', [roleId]);
  for (const p of new Set(perms)) {
    await db.query('INSERT INTO role_permissions (tenant_id, role_id, permission) VALUES ($1,$2,$3)', [tenantId, roleId, p]);
  }
}

rolesRouter.post(
  '/',
  requirePermission('core.roles.manage'),
  asyncHandler(async (req, res) => {
    const input = bodySchema.parse(req.body);
    const { tenantId, userId } = req.auth!;
    const id = await withTenant(tenantId, async (db) => {
      const r = await db.query('INSERT INTO roles (tenant_id, name, description) VALUES ($1,$2,$3) RETURNING id', [
        tenantId, input.name, input.description ?? null,
      ]);
      await setPermissions(db, tenantId, r.rows[0].id, input.permissions);
      await writeAudit(db, { tenantId, userId, action: 'role.create', entity: 'role', entityId: r.rows[0].id, newValue: input, ip: clientIp(req) });
      return r.rows[0].id as string;
    });
    res.status(201).json({ id });
  }),
);

rolesRouter.put(
  '/:id',
  requirePermission('core.roles.manage'),
  asyncHandler(async (req, res) => {
    const id = z.string().uuid().parse(req.params.id);
    const input = bodySchema.parse(req.body);
    const { tenantId, userId } = req.auth!;
    await withTenant(tenantId, async (db) => {
      // FOR UPDATE cannot be combined with GROUP BY, so lock the row first, then read its permissions.
      await db.query('SELECT 1 FROM roles WHERE id = $1 FOR UPDATE', [id]);
      const cur = await db.query(
        `SELECT r.name, r.is_system, COALESCE(array_agg(rp.permission) FILTER (WHERE rp.permission IS NOT NULL), '{}') AS permissions
           FROM roles r LEFT JOIN role_permissions rp ON rp.role_id = r.id WHERE r.id = $1 GROUP BY r.id`,
        [id],
      );
      if (!cur.rows[0]) throw notFound('Role not found');
      if (cur.rows[0].is_system) throw badRequest('System roles cannot be edited');
      await db.query('UPDATE roles SET name = $2, description = $3 WHERE id = $1', [id, input.name, input.description ?? null]);
      await setPermissions(db, tenantId, id, input.permissions);
      await writeAudit(db, {
        tenantId, userId, action: 'role.update', entity: 'role', entityId: id,
        oldValue: { name: cur.rows[0].name, permissions: cur.rows[0].permissions }, newValue: input, ip: clientIp(req),
      });
    });
    res.json({ ok: true });
  }),
);

rolesRouter.delete(
  '/:id',
  requirePermission('core.roles.manage'),
  asyncHandler(async (req, res) => {
    const id = z.string().uuid().parse(req.params.id);
    const { tenantId, userId } = req.auth!;
    await withTenant(tenantId, async (db) => {
      const cur = await db.query('SELECT name, is_system FROM roles WHERE id = $1', [id]);
      if (!cur.rows[0]) throw notFound('Role not found');
      if (cur.rows[0].is_system) throw badRequest('System roles cannot be deleted');
      const used = await db.query('SELECT count(*)::int AS n FROM user_roles WHERE role_id = $1', [id]);
      if (used.rows[0].n > 0) throw badRequest('Role is assigned to users. Remove it from them first.');
      await db.query('DELETE FROM roles WHERE id = $1', [id]);
      await writeAudit(db, { tenantId, userId, action: 'role.delete', entity: 'role', entityId: id, oldValue: cur.rows[0], ip: clientIp(req) });
    });
    res.json({ ok: true });
  }),
);

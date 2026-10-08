import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requirePermission } from '../../middleware/auth';
import { withTenant } from '../../db/pool';
import { asyncHandler } from '../../utils/errors';

export const auditRouter = Router();
auditRouter.use(authenticate, requirePermission('core.audit.read'));

const query = z.object({
  entity: z.string().trim().optional(),
  action: z.string().trim().optional(),
  userId: z.string().uuid().optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

auditRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = query.parse(req.query);
    const cond: string[] = [];
    const params: unknown[] = [];
    const add = (sql: string, v: unknown) => {
      params.push(v);
      cond.push(sql.replace('?', `$${params.length}`));
    };
    if (q.entity) add('a.entity = ?', q.entity);
    if (q.action) add('a.action = ?', q.action);
    if (q.userId) add('a.user_id = ?', q.userId);
    if (q.from) add('a.created_at >= ?::date', q.from);
    if (q.to) add("a.created_at < (?::date + 1)", q.to);
    const where = cond.length ? `WHERE ${cond.join(' AND ')}` : '';

    const out = await withTenant(req.auth!.tenantId, async (db) => {
      const total = await db.query(`SELECT count(*)::int AS n FROM audit_log a ${where}`, params);
      const rows = await db.query(
        `SELECT a.id, a.action, a.entity, a.entity_id AS "entityId", a.old_value AS "oldValue", a.new_value AS "newValue",
                a.ip, a.created_at AS "createdAt", u.full_name AS "userName"
           FROM audit_log a LEFT JOIN users u ON u.id = a.user_id ${where}
          ORDER BY a.id DESC LIMIT ${q.pageSize} OFFSET ${(q.page - 1) * q.pageSize}`,
        params,
      );
      return { items: rows.rows, total: total.rows[0].n, page: q.page, pageSize: q.pageSize };
    });
    res.json(out);
  }),
);

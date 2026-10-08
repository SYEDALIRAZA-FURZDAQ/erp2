import { Router } from 'express';
import { z } from 'zod';
import { authenticate, clientIp, requirePermission } from '../../middleware/auth';
import { withTenant } from '../../db/pool';
import { asyncHandler, badRequest } from '../../utils/errors';
import { writeAudit } from '../audit/audit.service';
import { formatDocNumber } from './numbering.service';

export const numberingRouter = Router();
numberingRouter.use(authenticate);

numberingRouter.get(
  '/',
  requirePermission('core.settings.read'),
  asyncHandler(async (req, res) => {
    const r = await withTenant(req.auth!.tenantId, (db) =>
      db.query(
        `SELECT id, doc_type AS "docType", fiscal_year AS "fiscalYear", prefix, padding, next_number::text AS "nextNumber"
           FROM number_series ORDER BY doc_type, fiscal_year`,
      ),
    );
    res.json(
      r.rows.map((s) => ({ ...s, preview: formatDocNumber(s.prefix, s.fiscalYear, s.padding, Number(s.nextNumber)) })),
    );
  }),
);

const putSchema = z.object({
  prefix: z.string().max(12),
  padding: z.number().int().min(1).max(12),
  nextNumber: z.number().int().min(1).optional(),
});

numberingRouter.put(
  '/:id',
  requirePermission('core.numbering.manage'),
  asyncHandler(async (req, res) => {
    const id = z.string().uuid().parse(req.params.id);
    const input = putSchema.parse(req.body);
    const { tenantId, userId } = req.auth!;
    await withTenant(tenantId, async (db) => {
      const cur = await db.query('SELECT prefix, padding, next_number FROM number_series WHERE id = $1 FOR UPDATE', [id]);
      if (!cur.rows[0]) throw badRequest('Series not found');
      if (input.nextNumber !== undefined && input.nextNumber < Number(cur.rows[0].next_number)) {
        throw badRequest('Next number can only move forward (documents already used the lower numbers)');
      }
      await db.query(
        'UPDATE number_series SET prefix = $2, padding = $3, next_number = COALESCE($4, next_number) WHERE id = $1',
        [id, input.prefix, input.padding, input.nextNumber ?? null],
      );
      await writeAudit(db, {
        tenantId, userId, action: 'numbering.update', entity: 'number_series', entityId: id,
        oldValue: cur.rows[0], newValue: input, ip: clientIp(req),
      });
    });
    res.json({ ok: true });
  }),
);

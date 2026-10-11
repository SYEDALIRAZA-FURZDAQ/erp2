import { Router } from 'express';
import { z } from 'zod';
import { authenticate, clientIp, requirePermission } from '../../middleware/auth';
import { withTenant } from '../../db/pool';
import { asyncHandler, badRequest, forbidden, notFound } from '../../utils/errors';
import { writeAudit } from '../audit/audit.service';
import { nextDocNumber } from '../numbering/numbering.service';
import { verifyPassword } from '../../utils/password';

export const assetsRouter = Router();
assetsRouter.use(authenticate);

const assetSchema = z.object({
  name: z.string().trim().min(2).max(150),
  category: z.enum(['vehicles', 'it_equipment', 'machinery', 'furniture', 'building', 'other']),
  purchaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).default(() => new Date().toISOString().slice(0, 10)),
  purchaseCost: z.coerce.number().positive(),
  salvageValue: z.coerce.number().min(0).default(0),
  usefulLifeYears: z.coerce.number().positive(),
  location: z.string().trim().max(100).nullish(),
});

assetsRouter.get(
  '/',
  requirePermission('assets.register.read'),
  asyncHandler(async (req, res) => {
    const tenantId = req.auth!.tenantId;
    const out = await withTenant(tenantId, async (db) => {
      const rows = await db.query(
        `SELECT a.id, a.asset_code AS "assetCode", a.name, a.category,
                a.purchase_date AS "purchaseDate", a.purchase_cost AS "purchaseCost",
                a.salvage_value AS "salvageValue", a.useful_life_years AS "usefulLifeYears",
                a.accumulated_depreciation AS "accumulatedDepreciation",
                a.current_value AS "currentValue", a.location, a.status, a.created_at AS "createdAt",
                COUNT(d.id)::int AS "depreciationCount"
           FROM fixed_assets a
           LEFT JOIN asset_depreciation_logs d ON d.asset_id = a.id
          GROUP BY a.id
          ORDER BY a.asset_code ASC`
      );
      return rows.rows;
    });
    res.json(out);
  }),
);

assetsRouter.post(
  '/',
  requirePermission('assets.register.manage'),
  asyncHandler(async (req, res) => {
    const input = assetSchema.parse(req.body);
    const tenantId = req.auth!.tenantId;

    const out = await withTenant(tenantId, async (db) => {
      let assetCode = '';
      try {
        assetCode = await nextDocNumber(db, tenantId, 'fixed_asset');
      } catch {
        assetCode = `AST-${Date.now().toString().slice(-5)}`;
      }

      const r = await db.query(
        `INSERT INTO fixed_assets (
          tenant_id, asset_code, name, category, purchase_date, purchase_cost,
          salvage_value, useful_life_years, current_value, location
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id, asset_code AS "assetCode", name`,
        [
          tenantId,
          assetCode,
          input.name,
          input.category,
          input.purchaseDate,
          input.purchaseCost,
          input.salvageValue,
          input.usefulLifeYears,
          input.purchaseCost, // initial current value = purchase cost
          input.location || null,
        ]
      );

      await writeAudit(db, {
        tenantId,
        userId: req.auth!.userId,
        action: 'fixed_asset.create',
        entity: 'fixed_asset',
        entityId: r.rows[0].id,
        newValue: input,
        ip: clientIp(req),
      });

      return r.rows[0];
    });

    res.status(201).json(out);
  }),
);

assetsRouter.post(
  '/:id/depreciate',
  requirePermission('assets.depreciation.manage'),
  asyncHandler(async (req, res) => {
    const tenantId = req.auth!.tenantId;
    const assetId = req.params.id;

    const out = await withTenant(tenantId, async (db) => {
      const a = await db.query(
        `SELECT id, asset_code, name, purchase_cost, salvage_value, useful_life_years,
                accumulated_depreciation, current_value
           FROM fixed_assets WHERE id = $1`,
        [assetId]
      );
      if (!a.rows[0]) throw notFound('Asset not found');
      const asset = a.rows[0];

      const cost = Number(asset.purchase_cost);
      const salvage = Number(asset.salvage_value);
      const lifeYears = Number(asset.useful_life_years);
      const curVal = Number(asset.current_value);

      if (curVal <= salvage) {
        throw badRequest('Asset is already fully depreciated to salvage value');
      }

      // Monthly straight-line amount: ((Cost - Salvage) / LifeYears) / 12
      const annualDepreciation = (cost - salvage) / lifeYears;
      let monthlyDepreciation = Math.round((annualDepreciation / 12) * 100) / 100;
      if (curVal - monthlyDepreciation < salvage) {
        monthlyDepreciation = curVal - salvage;
      }

      const today = new Date().toISOString().slice(0, 10);
      await db.query(
        `INSERT INTO asset_depreciation_logs (tenant_id, asset_id, period_date, amount, notes)
         VALUES ($1, $2, $3, $4, 'Monthly straight-line depreciation run')`,
        [tenantId, assetId, today, monthlyDepreciation]
      );

      const updated = await db.query(
        `UPDATE fixed_assets
            SET accumulated_depreciation = accumulated_depreciation + $1,
                current_value = current_value - $1
          WHERE id = $2
          RETURNING current_value AS "currentValue", accumulated_depreciation AS "accumulatedDepreciation"`,
        [monthlyDepreciation, assetId]
      );

      // Post depreciation to accounting if accounts exist
      const depExp = await db.query("SELECT id FROM accounts WHERE code = '6030' LIMIT 1");
      const assetAcc = await db.query("SELECT id FROM accounts WHERE code = '1510' LIMIT 1");
      if (depExp.rows[0] && assetAcc.rows[0]) {
        try {
          const jvNum = await nextDocNumber(db, tenantId, 'journal_voucher');
          const jv = await db.query(
            `INSERT INTO journal_entries (tenant_id, entry_number, entry_date, voucher_type, narration, reference)
             VALUES ($1, $2, CURRENT_DATE, 'JV', $3, $4) RETURNING id`,
            [tenantId, jvNum, `Depreciation: ${asset.name} (${asset.asset_code})`, asset.asset_code]
          );
          const jvId = jv.rows[0].id;

          await db.query(
            `INSERT INTO journal_entry_lines (tenant_id, entry_id, account_id, debit, credit, description, line_number)
             VALUES ($1, $2, $3, $4, 0, 'Depreciation Expense', 1)`,
            [tenantId, jvId, depExp.rows[0].id, monthlyDepreciation]
          );

          await db.query(
            `INSERT INTO journal_entry_lines (tenant_id, entry_id, account_id, debit, credit, description, line_number)
             VALUES ($1, $2, $3, 0, $4, 'Accumulated Depreciation', 2)`,
            [tenantId, jvId, assetAcc.rows[0].id, monthlyDepreciation]
          );
        } catch {
          // ignore if numbering fails
        }
      }

      await writeAudit(db, {
        tenantId,
        userId: req.auth!.userId,
        action: 'fixed_asset.depreciate',
        entity: 'fixed_asset',
        entityId: assetId,
        newValue: { amount: monthlyDepreciation, ...updated.rows[0] },
        ip: clientIp(req),
      });

      return { amount: monthlyDepreciation, ...updated.rows[0] };
    });

    res.json(out);
  }),
);

// -------------------------------------------------------------
// Delete Fixed Asset (owner password-protected)
// Removes the asset, all depreciation logs, and linked journal
// entries that were posted for this asset's depreciation runs.
// -------------------------------------------------------------
assetsRouter.delete(
  '/:id',
  requirePermission('assets.register.manage'),
  asyncHandler(async (req, res) => {
    const { isOwner, userId, tenantId } = req.auth!;
    if (!isOwner) throw forbidden('Access denied. Only the company owner can delete fixed assets.');

    const { password } = z.object({
      password: z.string().min(1, 'Owner password is required to authorize asset deletion'),
    }).parse(req.body);

    const out = await withTenant(tenantId, async (db) => {
      // Verify owner password
      const userRes = await db.query('SELECT password_hash, is_owner FROM users WHERE id = $1', [userId]);
      const user = userRes.rows[0];
      if (!user?.is_owner) throw forbidden('Owner account required');

      const ok = await verifyPassword(password, user.password_hash);
      if (!ok) throw badRequest('Invalid owner password. Deletion authorization failed.');

      // Fetch the asset
      const assetRes = await db.query(
        `SELECT id, asset_code, name, category, purchase_cost, accumulated_depreciation, current_value, status
           FROM fixed_assets WHERE id = $1`,
        [req.params.id]
      );
      const asset = assetRes.rows[0];
      if (!asset) throw notFound('Fixed asset not found');

      // Count depreciation logs
      const logRes = await db.query(
        'SELECT count(*)::int AS n FROM asset_depreciation_logs WHERE asset_id = $1',
        [req.params.id]
      );
      const depreciationRunCount: number = logRes.rows[0].n;

      // Purge linked depreciation journal entries (matched by asset_code reference)
      const linkedJvs = await db.query(
        `SELECT id, entry_number FROM journal_entries WHERE reference = $1 OR narration LIKE $2`,
        [asset.asset_code, `%${asset.asset_code}%`]
      );
      if (linkedJvs.rows.length > 0) {
        const jvIds = linkedJvs.rows.map((r: any) => r.id);
        await db.query('DELETE FROM journal_entry_lines WHERE entry_id = ANY($1)', [jvIds]);
        await db.query('DELETE FROM journal_entries WHERE id = ANY($1)', [jvIds]);
      }

      // Delete depreciation logs
      await db.query('DELETE FROM asset_depreciation_logs WHERE asset_id = $1', [req.params.id]);

      // Delete the asset itself
      await db.query('DELETE FROM fixed_assets WHERE id = $1', [req.params.id]);

      await writeAudit(db, {
        tenantId,
        userId,
        action: 'fixed_asset.delete',
        entity: 'fixed_asset',
        entityId: req.params.id,
        newValue: {
          assetCode: asset.asset_code,
          name: asset.name,
          purchaseCost: asset.purchase_cost,
          depreciationRunsDeleted: depreciationRunCount,
          journalEntriesDeleted: linkedJvs.rows.map((r: any) => r.entry_number),
        },
        ip: clientIp(req),
      });

      return {
        success: true,
        message: `Fixed asset '${asset.name}' (${asset.asset_code}) deleted. ${depreciationRunCount} depreciation log(s) and ${linkedJvs.rows.length} journal entry(ies) have been removed.`,
      };
    });

    res.json(out);
  }),
);

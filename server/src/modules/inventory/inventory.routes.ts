import { Router } from 'express';
import { z } from 'zod';
import { authenticate, clientIp, requirePermission } from '../../middleware/auth';
import { withTenant } from '../../db/pool';
import { asyncHandler, badRequest } from '../../utils/errors';
import { writeAudit } from '../audit/audit.service';

export const inventoryRouter = Router();
inventoryRouter.use(authenticate);

// -------------------------------------------------------------
// 1. Items / Products Master
// -------------------------------------------------------------
const itemSchema = z.object({
  sku: z.string().trim().min(2).max(50),
  name: z.string().trim().min(2).max(150),
  category: z.string().trim().max(50).nullish(),
  uom: z.string().trim().min(1).max(20).default('pcs'),
  costPrice: z.coerce.number().min(0).default(0),
  sellingPrice: z.coerce.number().min(0).default(0),
  taxRate: z.coerce.number().min(0).default(18),
  reorderLevel: z.coerce.number().min(0).default(10),
});

inventoryRouter.get(
  '/items',
  requirePermission('inventory.items.read'),
  asyncHandler(async (req, res) => {
    const tenantId = req.auth!.tenantId;
    const out = await withTenant(tenantId, async (db) => {
      const rows = await db.query(
        `SELECT it.id, it.sku, it.name, it.category, it.uom,
                it.cost_price AS "costPrice", it.selling_price AS "sellingPrice",
                it.tax_rate AS "taxRate", it.reorder_level AS "reorderLevel",
                it.is_active AS "isActive", it.created_at AS "createdAt",
                COALESCE(SUM(sm.quantity), 0)::numeric(12,2) AS "currentStock",
                (COALESCE(SUM(sm.quantity), 0) <= it.reorder_level) AS "isLowStock"
           FROM items it
           LEFT JOIN stock_movements sm ON sm.item_id = it.id
          GROUP BY it.id
          ORDER BY it.name ASC`
      );
      return rows.rows;
    });
    res.json(out);
  }),
);

inventoryRouter.post(
  '/items',
  requirePermission('inventory.items.manage'),
  asyncHandler(async (req, res) => {
    const input = itemSchema.parse(req.body);
    const tenantId = req.auth!.tenantId;

    const out = await withTenant(tenantId, async (db) => {
      const exists = await db.query('SELECT 1 FROM items WHERE sku = $1', [input.sku]);
      if (exists.rowCount) throw badRequest(`Item SKU '${input.sku}' already exists`);

      const r = await db.query(
        `INSERT INTO items (tenant_id, sku, name, category, uom, cost_price, selling_price, tax_rate, reorder_level)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id, sku, name, category, uom, cost_price AS "costPrice",
                   selling_price AS "sellingPrice", tax_rate AS "taxRate", reorder_level AS "reorderLevel"`,
        [
          tenantId,
          input.sku,
          input.name,
          input.category || null,
          input.uom,
          input.costPrice,
          input.sellingPrice,
          input.taxRate,
          input.reorderLevel,
        ]
      );

      await writeAudit(db, {
        tenantId,
        userId: req.auth!.userId,
        action: 'item.create',
        entity: 'item',
        entityId: r.rows[0].id,
        newValue: input,
        ip: clientIp(req),
      });

      return r.rows[0];
    });

    res.status(201).json(out);
  }),
);

// -------------------------------------------------------------
// 2. Warehouses
// -------------------------------------------------------------
const warehouseSchema = z.object({
  code: z.string().trim().min(2).max(30),
  name: z.string().trim().min(2).max(100),
  address: z.string().trim().max(300).nullish(),
});

inventoryRouter.get(
  '/warehouses',
  requirePermission('inventory.items.read'),
  asyncHandler(async (req, res) => {
    const tenantId = req.auth!.tenantId;
    const out = await withTenant(tenantId, async (db) => {
      const rows = await db.query(
        `SELECT w.id, w.code, w.name, w.address, w.is_active AS "isActive", w.created_at AS "createdAt",
                COUNT(DISTINCT sm.item_id)::int AS "uniqueItemCount",
                COALESCE(SUM(sm.quantity), 0)::numeric(12,2) AS "totalUnitsInStock"
           FROM warehouses w
           LEFT JOIN stock_movements sm ON sm.warehouse_id = w.id
          GROUP BY w.id
          ORDER BY w.code ASC`
      );
      return rows.rows;
    });
    res.json(out);
  }),
);

inventoryRouter.post(
  '/warehouses',
  requirePermission('inventory.warehouses.manage'),
  asyncHandler(async (req, res) => {
    const input = warehouseSchema.parse(req.body);
    const tenantId = req.auth!.tenantId;

    const out = await withTenant(tenantId, async (db) => {
      const exists = await db.query('SELECT 1 FROM warehouses WHERE code = $1', [input.code]);
      if (exists.rowCount) throw badRequest(`Warehouse code '${input.code}' already exists`);

      const r = await db.query(
        `INSERT INTO warehouses (tenant_id, code, name, address)
         VALUES ($1, $2, $3, $4)
         RETURNING id, code, name, address, is_active AS "isActive"`,
        [tenantId, input.code, input.name, input.address || null]
      );

      await writeAudit(db, {
        tenantId,
        userId: req.auth!.userId,
        action: 'warehouse.create',
        entity: 'warehouse',
        entityId: r.rows[0].id,
        newValue: input,
        ip: clientIp(req),
      });

      return r.rows[0];
    });

    res.status(201).json(out);
  }),
);

// -------------------------------------------------------------
// 3. Stock Movements & Adjustments
// -------------------------------------------------------------
const movementSchema = z.object({
  itemId: z.string().uuid(),
  warehouseId: z.string().uuid(),
  movementType: z.enum(['in', 'out', 'adjustment', 'transfer']),
  quantity: z.coerce.number(),
  unitCost: z.coerce.number().min(0).default(0),
  reference: z.string().trim().max(100).nullish(),
  notes: z.string().trim().max(300).nullish(),
});

inventoryRouter.get(
  '/movements',
  requirePermission('inventory.items.read'),
  asyncHandler(async (req, res) => {
    const tenantId = req.auth!.tenantId;
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 25));

    const out = await withTenant(tenantId, async (db) => {
      const total = await db.query('SELECT count(*)::int AS n FROM stock_movements');
      const rows = await db.query(
        `SELECT sm.id, sm.movement_type AS "movementType", sm.quantity, sm.unit_cost AS "unitCost",
                sm.reference, sm.notes, sm.created_at AS "createdAt",
                it.id AS "itemId", it.sku, it.name AS "itemName", it.uom,
                w.id AS "warehouseId", w.name AS "warehouseName", w.code AS "warehouseCode"
           FROM stock_movements sm
           JOIN items it ON it.id = sm.item_id
           JOIN warehouses w ON w.id = sm.warehouse_id
          ORDER BY sm.created_at DESC
          LIMIT $1 OFFSET $2`,
        [pageSize, (page - 1) * pageSize]
      );
      return { items: rows.rows, total: total.rows[0].n, page, pageSize };
    });

    res.json(out);
  }),
);

inventoryRouter.post(
  '/movements',
  requirePermission('inventory.stock.manage'),
  asyncHandler(async (req, res) => {
    const input = movementSchema.parse(req.body);
    const tenantId = req.auth!.tenantId;

    const out = await withTenant(tenantId, async (db) => {
      // Calculate adjusted qty based on direction
      let qty = input.quantity;
      if (input.movementType === 'out' && qty > 0) qty = -qty;

      const r = await db.query(
        `INSERT INTO stock_movements (tenant_id, item_id, warehouse_id, movement_type, quantity, unit_cost, reference, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, movement_type AS "movementType", quantity, created_at AS "createdAt"`,
        [tenantId, input.itemId, input.warehouseId, input.movementType, qty, input.unitCost, input.reference || null, input.notes || null]
      );

      await writeAudit(db, {
        tenantId,
        userId: req.auth!.userId,
        action: 'stock.movement',
        entity: 'stock_movement',
        entityId: r.rows[0].id,
        newValue: input,
        ip: clientIp(req),
      });

      return r.rows[0];
    });

    res.status(201).json(out);
  }),
);

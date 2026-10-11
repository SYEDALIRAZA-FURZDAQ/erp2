import { Router } from 'express';
import { z } from 'zod';
import { authenticate, clientIp, requirePermission } from '../../middleware/auth';
import { withTenant } from '../../db/pool';
import { asyncHandler, badRequest, forbidden, notFound } from '../../utils/errors';
import { writeAudit } from '../audit/audit.service';
import { nextDocNumber } from '../numbering/numbering.service';
import { verifyPassword } from '../../utils/password';

export const purchaseRouter = Router();
purchaseRouter.use(authenticate);

// -------------------------------------------------------------
// 1. Vendors
// -------------------------------------------------------------
const vendorSchema = z.object({
  name: z.string().trim().min(2).max(150),
  ntn: z.string().trim().max(30).nullish(),
  strn: z.string().trim().max(30).nullish(),
  contactPerson: z.string().trim().max(100).nullish(),
  phone: z.string().trim().max(30).nullish(),
  email: z.string().trim().email().nullish().or(z.literal('')),
  address: z.string().trim().max(300).nullish(),
  city: z.string().trim().max(50).nullish(),
  paymentTerms: z.string().trim().max(50).nullish(),
});

purchaseRouter.get(
  '/vendors',
  requirePermission('purchase.vendors.read'),
  asyncHandler(async (req, res) => {
    const tenantId = req.auth!.tenantId;
    const out = await withTenant(tenantId, async (db) => {
      const rows = await db.query(
        `SELECT v.id, v.name, v.ntn, v.strn, v.contact_person AS "contactPerson",
                v.phone, v.email, v.address, v.city, v.payment_terms AS "paymentTerms",
                v.created_at AS "createdAt",
                COALESCE(SUM(pb.grand_total), 0)::numeric(14,2) AS "totalBilled"
           FROM vendors v
           LEFT JOIN purchase_bills pb ON pb.vendor_id = v.id
          GROUP BY v.id
          ORDER BY v.created_at DESC`
      );
      return rows.rows;
    });
    res.json(out);
  }),
);

purchaseRouter.post(
  '/vendors',
  requirePermission('purchase.vendors.manage'),
  asyncHandler(async (req, res) => {
    const input = vendorSchema.parse(req.body);
    const tenantId = req.auth!.tenantId;

    const out = await withTenant(tenantId, async (db) => {
      const r = await db.query(
        `INSERT INTO vendors (tenant_id, name, ntn, strn, contact_person, phone, email, address, city, payment_terms)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id, name, ntn, strn, contact_person AS "contactPerson", phone, email, address, city, payment_terms AS "paymentTerms"`,
        [
          tenantId,
          input.name,
          input.ntn || null,
          input.strn || null,
          input.contactPerson || null,
          input.phone || null,
          input.email || null,
          input.address || null,
          input.city || null,
          input.paymentTerms || null,
        ]
      );

      await writeAudit(db, {
        tenantId,
        userId: req.auth!.userId,
        action: 'vendor.create',
        entity: 'vendor',
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
// 1b. Update Vendor
// -------------------------------------------------------------
const vendorUpdateSchema = z.object({
  name: z.string().trim().min(2).max(150).optional(),
  ntn: z.string().trim().max(30).nullish(),
  strn: z.string().trim().max(30).nullish(),
  contactPerson: z.string().trim().max(100).nullish(),
  phone: z.string().trim().max(30).nullish(),
  email: z.string().trim().email().nullish().or(z.literal('')),
  address: z.string().trim().max(300).nullish(),
  city: z.string().trim().max(50).nullish(),
  paymentTerms: z.string().trim().max(50).nullish(),
});

purchaseRouter.put(
  '/vendors/:id',
  requirePermission('purchase.vendors.manage'),
  asyncHandler(async (req, res) => {
    const input = vendorUpdateSchema.parse(req.body);
    const tenantId = req.auth!.tenantId;
    const vendorId = req.params.id;

    const out = await withTenant(tenantId, async (db) => {
      const existing = await db.query('SELECT id, name FROM vendors WHERE id = $1', [vendorId]);
      if (!existing.rows[0]) throw notFound('Supplier / Vendor not found');

      const setClauses: string[] = [];
      const values: unknown[] = [];
      let idx = 1;

      const fieldMap: Record<string, string> = {
        name: 'name',
        ntn: 'ntn',
        strn: 'strn',
        contactPerson: 'contact_person',
        phone: 'phone',
        email: 'email',
        address: 'address',
        city: 'city',
        paymentTerms: 'payment_terms',
      };

      for (const [key, col] of Object.entries(fieldMap)) {
        if ((input as any)[key] !== undefined) {
          setClauses.push(`${col} = $${idx}`);
          values.push((input as any)[key] || null);
          idx++;
        }
      }

      if (setClauses.length === 0) throw badRequest('No fields to update');

      values.push(vendorId);
      const r = await db.query(
        `UPDATE vendors SET ${setClauses.join(', ')}
         WHERE id = $${idx}
         RETURNING id, name, ntn, strn, contact_person AS "contactPerson",
                   phone, email, address, city, payment_terms AS "paymentTerms"`,
        values
      );

      await writeAudit(db, {
        tenantId,
        userId: req.auth!.userId,
        action: 'vendor.update',
        entity: 'vendor',
        entityId: vendorId,
        newValue: input,
        ip: clientIp(req),
      });

      return r.rows[0];
    });

    res.json(out);
  }),
);

// -------------------------------------------------------------
// 1c. Delete Vendor
// -------------------------------------------------------------
purchaseRouter.delete(
  '/vendors/:id',
  requirePermission('purchase.vendors.manage'),
  asyncHandler(async (req, res) => {
    const tenantId = req.auth!.tenantId;
    const vendorId = req.params.id;

    await withTenant(tenantId, async (db) => {
      const existing = await db.query('SELECT id, name FROM vendors WHERE id = $1', [vendorId]);
      if (!existing.rows[0]) throw notFound('Supplier / Vendor not found');

      const bills = await db.query('SELECT count(*)::int AS n FROM purchase_bills WHERE vendor_id = $1', [vendorId]);
      if (bills.rows[0].n > 0) {
        throw badRequest(
          `Cannot delete vendor '${existing.rows[0].name}' because they have ${bills.rows[0].n} purchase bill(s) recorded against them.`
        );
      }

      await db.query('DELETE FROM vendors WHERE id = $1', [vendorId]);

      await writeAudit(db, {
        tenantId,
        userId: req.auth!.userId,
        action: 'vendor.delete',
        entity: 'vendor',
        entityId: vendorId,
        newValue: { name: existing.rows[0].name },
        ip: clientIp(req),
      });
    });

    res.json({ success: true, message: 'Vendor removed successfully' });
  }),
);

// -------------------------------------------------------------
// 2. Purchase Bills / Invoices
// -------------------------------------------------------------
const billItemSchema = z.object({
  itemId: z.string().uuid().nullish().or(z.literal('')),
  description: z.string().trim().min(1).max(255),
  quantity: z.coerce.number().positive(),
  unitCost: z.coerce.number().min(0),
  taxRate: z.coerce.number().min(0).default(0),
});

const billCreateSchema = z.object({
  vendorId: z.string().uuid(),
  warehouseId: z.string().uuid().nullish().or(z.literal('')),
  billDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).default(() => new Date().toISOString().slice(0, 10)),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish().or(z.literal('')),
  notes: z.string().trim().max(500).nullish().or(z.literal('')),
  items: z.array(billItemSchema).min(1, 'Bill must have at least 1 item'),
});

purchaseRouter.get(
  '/bills',
  requirePermission('purchase.bills.read'),
  asyncHandler(async (req, res) => {
    const tenantId = req.auth!.tenantId;
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 25));

    const out = await withTenant(tenantId, async (db) => {
      const total = await db.query('SELECT count(*)::int AS n FROM purchase_bills');
      const rows = await db.query(
        `SELECT pb.id, pb.bill_number AS "billNumber", pb.bill_date AS "billDate",
                pb.due_date AS "dueDate", pb.status, pb.subtotal, pb.tax_amount AS "taxAmount",
                pb.grand_total AS "grandTotal", pb.created_at AS "createdAt",
                v.id AS "vendorId", v.name AS "vendorName", v.ntn AS "vendorNtn"
           FROM purchase_bills pb
           JOIN vendors v ON v.id = pb.vendor_id
          ORDER BY pb.bill_date DESC, pb.created_at DESC
          LIMIT $1 OFFSET $2`,
        [pageSize, (page - 1) * pageSize]
      );
      return { items: rows.rows, total: total.rows[0].n, page, pageSize };
    });

    res.json(out);
  }),
);

purchaseRouter.get(
  '/bills/:id',
  requirePermission('purchase.bills.read'),
  asyncHandler(async (req, res) => {
    const tenantId = req.auth!.tenantId;
    const out = await withTenant(tenantId, async (db) => {
      const b = await db.query(
        `SELECT pb.id, pb.bill_number AS "billNumber", pb.bill_date AS "billDate",
                pb.due_date AS "dueDate", pb.status, pb.subtotal, pb.tax_amount AS "taxAmount",
                pb.grand_total AS "grandTotal", pb.notes, pb.created_at AS "createdAt",
                v.id AS "vendorId", v.name AS "vendorName", v.ntn AS "vendorNtn",
                v.phone AS "vendorPhone", v.email AS "vendorEmail", v.address AS "vendorAddress"
           FROM purchase_bills pb
           JOIN vendors v ON v.id = pb.vendor_id
          WHERE pb.id = $1`,
        [req.params.id]
      );
      if (!b.rows[0]) throw notFound('Purchase bill not found');

      const items = await db.query(
        `SELECT pbi.id, pbi.item_id AS "itemId", pbi.description, pbi.quantity,
                pbi.unit_cost AS "unitCost", pbi.tax_rate AS "taxRate", pbi.tax_amount AS "taxAmount",
                pbi.total, it.sku, it.name AS "itemName"
           FROM purchase_bill_items pbi
           LEFT JOIN items it ON it.id = pbi.item_id
          WHERE pbi.bill_id = $1`,
        [req.params.id]
      );

      return { ...b.rows[0], items: items.rows };
    });

    res.json(out);
  }),
);

purchaseRouter.post(
  '/bills',
  requirePermission('purchase.bills.manage'),
  asyncHandler(async (req, res) => {
    const input = billCreateSchema.parse(req.body);
    const tenantId = req.auth!.tenantId;

    const cleanWarehouseId = input.warehouseId && input.warehouseId.trim() !== '' ? input.warehouseId : null;
    const cleanDueDate = input.dueDate && input.dueDate.trim() !== '' ? input.dueDate : null;
    const cleanNotes = input.notes && input.notes.trim() !== '' ? input.notes : null;

    let subtotal = 0;
    let totalTax = 0;
    const computedItems = input.items.map((item) => {
      const cleanItemId = item.itemId && item.itemId.trim() !== '' ? item.itemId : null;
      const lineSubtotal = item.quantity * item.unitCost;
      const lineTax = (lineSubtotal * item.taxRate) / 100;
      const lineTotal = lineSubtotal + lineTax;
      subtotal += lineSubtotal;
      totalTax += lineTax;
      return { ...item, itemId: cleanItemId, lineTax, lineTotal };
    });

    const grandTotal = subtotal + totalTax;

    const out = await withTenant(tenantId, async (db) => {
      let billNumber = '';
      try {
        billNumber = await nextDocNumber(db, tenantId, 'purchase_bill');
      } catch {
        billNumber = `BILL-${Date.now().toString().slice(-6)}`;
      }

      const bill = await db.query(
        `INSERT INTO purchase_bills (
          tenant_id, bill_number, vendor_id, warehouse_id, bill_date, due_date,
          status, subtotal, tax_amount, grand_total, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, 'received', $7, $8, $9, $10)
        RETURNING id, bill_number AS "billNumber"`,
        [
          tenantId,
          billNumber,
          input.vendorId,
          cleanWarehouseId,
          input.billDate,
          cleanDueDate,
          subtotal.toFixed(2),
          totalTax.toFixed(2),
          grandTotal.toFixed(2),
          cleanNotes,
        ]
      );
      const billId = bill.rows[0].id;

      for (const item of computedItems) {
        await db.query(
          `INSERT INTO purchase_bill_items (
            tenant_id, bill_id, item_id, description, quantity, unit_cost, tax_rate, tax_amount, total
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            tenantId,
            billId,
            item.itemId ?? null,
            item.description,
            item.quantity,
            item.unitCost,
            item.taxRate,
            item.lineTax.toFixed(2),
            item.lineTotal.toFixed(2),
          ]
        );

        // Auto add stock into warehouse
        if (item.itemId && cleanWarehouseId) {
          await db.query(
            `INSERT INTO stock_movements (tenant_id, item_id, warehouse_id, movement_type, quantity, unit_cost, reference, notes)
             VALUES ($1, $2, $3, 'in', $4, $5, $6, 'Purchase Goods Receipt')`,
            [tenantId, item.itemId, cleanWarehouseId, item.quantity, item.unitCost, billNumber]
          );
        }
      }

      // Auto-post accounting entry
      const invAcc = await db.query("SELECT id FROM accounts WHERE code = '1040' LIMIT 1");
      const apAcc = await db.query("SELECT id FROM accounts WHERE code = '2010' LIMIT 1");
      if (invAcc.rows[0] && apAcc.rows[0]) {
        try {
          const jvNum = await nextDocNumber(db, tenantId, 'journal_voucher');
          const jv = await db.query(
            `INSERT INTO journal_entries (tenant_id, entry_number, entry_date, voucher_type, narration, reference)
             VALUES ($1, $2, $3, 'PI', $4, $5) RETURNING id`,
            [tenantId, jvNum, input.billDate, `Purchase Bill ${billNumber}`, billNumber]
          );
          const jvId = jv.rows[0].id;

          // Debit Inventory Asset
          await db.query(
            `INSERT INTO journal_entry_lines (tenant_id, entry_id, account_id, debit, credit, description, line_number)
             VALUES ($1, $2, $3, $4, 0, $5, 1)`,
            [tenantId, jvId, invAcc.rows[0].id, grandTotal.toFixed(2), `Purchase ${billNumber}`]
          );

          // Credit Accounts Payable
          await db.query(
            `INSERT INTO journal_entry_lines (tenant_id, entry_id, account_id, debit, credit, description, line_number)
             VALUES ($1, $2, $3, 0, $4, $5, 2)`,
            [tenantId, jvId, apAcc.rows[0].id, grandTotal.toFixed(2), `AP Vendor Bill ${billNumber}`]
          );
        } catch {
          // Continue if accounts not configured
        }
      }

      await writeAudit(db, {
        tenantId,
        userId: req.auth!.userId,
        action: 'purchase_bill.create',
        entity: 'purchase_bill',
        entityId: billId,
        newValue: { billNumber, grandTotal, items: computedItems.length },
        ip: clientIp(req),
      });

      return { id: billId, billNumber, grandTotal };
    });

    res.status(201).json(out);
  }),
);

purchaseRouter.post(
  '/bills/:id/status',
  requirePermission('purchase.bills.manage'),
  asyncHandler(async (req, res) => {
    const { status } = z.object({ status: z.enum(['draft', 'received', 'paid', 'cancelled']) }).parse(req.body);
    const tenantId = req.auth!.tenantId;

    await withTenant(tenantId, async (db) => {
      const r = await db.query('UPDATE purchase_bills SET status = $1 WHERE id = $2 RETURNING id, bill_number', [status, req.params.id]);
      if (!r.rowCount) throw notFound('Purchase bill not found');

      if (status === 'cancelled') {
        const billNum = r.rows[0].bill_number;
        // Unpost / void linked journal entries
        await db.query(
          `UPDATE journal_entries
              SET is_posted = false, reversed_at = now(), reversal_reason = 'Purchase bill cancelled'
            WHERE (reference = $1 OR narration LIKE '%' || $1 || '%') AND is_posted = true`,
          [billNum],
        );
        // Revert received inventory stock movements
        await db.query(
          `DELETE FROM stock_movements WHERE reference = $1 AND notes = 'Purchase Goods Receipt'`,
          [billNum],
        );
      }

      await writeAudit(db, {
        tenantId,
        userId: req.auth!.userId,
        action: 'purchase_bill.update_status',
        entity: 'purchase_bill',
        entityId: req.params.id,
        newValue: { status },
        ip: clientIp(req),
      });
    });

    res.json({ success: true, status });
  }),
);

// -------------------------------------------------------------
// 2c. Delete Purchase Bill (owner password-protected)
// -------------------------------------------------------------
purchaseRouter.delete(
  '/bills/:id',
  requirePermission('purchase.bills.manage'),
  asyncHandler(async (req, res) => {
    const { isOwner, userId, tenantId } = req.auth!;
    if (!isOwner) throw forbidden('Access denied. Only the company owner can delete purchase bills.');

    const { password } = z.object({
      password: z.string().min(1, 'Owner password is required to authorize bill deletion'),
    }).parse(req.body);

    const out = await withTenant(tenantId, async (db) => {
      // Verify owner password
      const userRes = await db.query('SELECT password_hash, is_owner FROM users WHERE id = $1', [userId]);
      const user = userRes.rows[0];
      if (!user?.is_owner) throw forbidden('Owner account required');

      const ok = await verifyPassword(password, user.password_hash);
      if (!ok) throw badRequest('Invalid owner password. Deletion authorization failed.');

      // Fetch the bill
      const billRes = await db.query(
        `SELECT pb.id, pb.bill_number, pb.warehouse_id, pb.grand_total, pb.status
           FROM purchase_bills pb
          WHERE pb.id = $1`,
        [req.params.id]
      );
      const bill = billRes.rows[0];
      if (!bill) throw notFound('Purchase bill not found');

      // Fetch bill items (for stock reversal)
      const itemsRes = await db.query(
        `SELECT item_id, quantity, unit_cost FROM purchase_bill_items WHERE bill_id = $1 AND item_id IS NOT NULL`,
        [req.params.id]
      );

      // Reverse stock movements if the bill was received into a warehouse
      if (bill.warehouse_id) {
        for (const item of itemsRes.rows) {
          await db.query(
            `INSERT INTO stock_movements (tenant_id, item_id, warehouse_id, movement_type, quantity, unit_cost, reference, notes)
             VALUES ($1, $2, $3, 'out', $4, $5, $6, 'Purchase Bill Deleted / Reversed')`,
            [tenantId, item.item_id, bill.warehouse_id, item.quantity, item.unit_cost, bill.bill_number]
          );
        }
      }

      // Purge linked accounting journal vouchers
      const linkedJvs = await db.query(
        `SELECT id, entry_number FROM journal_entries WHERE reference = $1 OR narration LIKE $2`,
        [bill.bill_number, `%${bill.bill_number}%`]
      );
      if (linkedJvs.rows.length > 0) {
        const jvIds = linkedJvs.rows.map((r: any) => r.id);
        await db.query('DELETE FROM journal_entry_lines WHERE entry_id = ANY($1)', [jvIds]);
        await db.query('DELETE FROM journal_entries WHERE id = ANY($1)', [jvIds]);
      }

      // Delete bill items and then the bill
      await db.query('DELETE FROM purchase_bill_items WHERE bill_id = $1', [req.params.id]);
      await db.query('DELETE FROM purchase_bills WHERE id = $1', [req.params.id]);

      await writeAudit(db, {
        tenantId,
        userId,
        action: 'purchase_bill.delete',
        entity: 'purchase_bill',
        entityId: req.params.id,
        newValue: {
          billNumber: bill.bill_number,
          grandTotal: bill.grand_total,
          status: bill.status,
          deletedJvs: linkedJvs.rows.map((r: any) => r.entry_number),
        },
        ip: clientIp(req),
      });

      return {
        success: true,
        message: `Purchase bill ${bill.bill_number} deleted successfully. Stock movements have been reversed and linked accounting entries removed.`,
      };
    });

    res.json(out);
  }),
);


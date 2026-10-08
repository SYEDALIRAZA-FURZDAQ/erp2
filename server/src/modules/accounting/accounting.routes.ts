import { Router } from 'express';
import { z } from 'zod';
import { authenticate, clientIp, requirePermission } from '../../middleware/auth';
import { withTenant } from '../../db/pool';
import { asyncHandler, badRequest, forbidden, notFound } from '../../utils/errors';
import { writeAudit } from '../audit/audit.service';
import { nextDocNumber } from '../numbering/numbering.service';
import { verifyPassword } from '../../utils/password';

export const accountingRouter = Router();
accountingRouter.use(authenticate);

// -------------------------------------------------------------
// 1. Chart of Accounts
// -------------------------------------------------------------
const accountCreateSchema = z.object({
  code: z.string().trim().min(1).max(20),
  name: z.string().trim().min(2).max(100),
  type: z.enum(['asset', 'liability', 'equity', 'revenue', 'expense']),
  subtype: z.string().trim().max(50).nullish(),
  parentId: z.string().uuid().nullish(),
});

accountingRouter.get(
  '/accounts',
  requirePermission('accounting.accounts.read'),
  asyncHandler(async (req, res) => {
    const tenantId = req.auth!.tenantId;
    const result = await withTenant(tenantId, async (db) => {
      const rows = await db.query(
        `SELECT a.id, a.code, a.name, a.type, a.subtype, a.parent_id AS "parentId", a.is_active AS "isActive",
                COALESCE(
                  CASE
                    WHEN a.type IN ('asset', 'expense') THEN SUM(CASE WHEN j.is_posted = true THEN jl.debit - jl.credit ELSE 0 END)
                    ELSE SUM(CASE WHEN j.is_posted = true THEN jl.credit - jl.debit ELSE 0 END)
                  END, 0
                )::numeric(14,2) AS balance
           FROM accounts a
           LEFT JOIN journal_entry_lines jl ON jl.account_id = a.id
           LEFT JOIN journal_entries j ON j.id = jl.entry_id
          GROUP BY a.id
          ORDER BY a.code ASC`
      );
      return rows.rows;
    });
    res.json(result);
  }),
);

accountingRouter.post(
  '/accounts',
  requirePermission('accounting.accounts.manage'),
  asyncHandler(async (req, res) => {
    const input = accountCreateSchema.parse(req.body);
    const tenantId = req.auth!.tenantId;

    const out = await withTenant(tenantId, async (db) => {
      const exists = await db.query('SELECT 1 FROM accounts WHERE code = $1', [input.code]);
      if (exists.rowCount) throw badRequest(`Account code '${input.code}' already exists`);

      const r = await db.query(
        `INSERT INTO accounts (tenant_id, code, name, type, subtype, parent_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, code, name, type, subtype, is_active AS "isActive"`,
        [tenantId, input.code, input.name, input.type, input.subtype ?? null, input.parentId ?? null]
      );

      await writeAudit(db, {
        tenantId,
        userId: req.auth!.userId,
        action: 'account.create',
        entity: 'account',
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
// 2. Journal Vouchers / Entries
// -------------------------------------------------------------
const voucherLineSchema = z.object({
  accountId: z.string().uuid(),
  debit: z.coerce.number().min(0).default(0),
  credit: z.coerce.number().min(0).default(0),
  description: z.string().trim().max(255).nullish(),
});

const voucherCreateSchema = z.object({
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).default(() => new Date().toISOString().slice(0, 10)),
  voucherType: z.enum(['JV', 'CV', 'BV', 'SI', 'PI']).default('JV'),
  narration: z.string().trim().max(500).nullish(),
  reference: z.string().trim().max(100).nullish(),
  lines: z.array(voucherLineSchema).min(2, 'Journal entry must have at least 2 lines'),
});

accountingRouter.get(
  '/vouchers',
  requirePermission('accounting.vouchers.read'),
  asyncHandler(async (req, res) => {
    const tenantId = req.auth!.tenantId;
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 25));

    const out = await withTenant(tenantId, async (db) => {
      const total = await db.query('SELECT count(*)::int AS n FROM journal_entries');
      const rows = await db.query(
        `SELECT j.id, j.entry_number AS "entryNumber", j.entry_date AS "entryDate",
                j.voucher_type AS "voucherType", j.narration, j.reference, j.is_posted AS "isPosted",
                j.reversed_at AS "reversedAt", j.reversal_reason AS "reversalReason",
                j.created_at AS "createdAt",
                COALESCE(SUM(l.debit), 0)::numeric(14,2) AS "totalDebit",
                COALESCE(SUM(l.credit), 0)::numeric(14,2) AS "totalCredit",
                COUNT(l.id)::int AS "lineCount"
           FROM journal_entries j
           LEFT JOIN journal_entry_lines l ON l.entry_id = j.id
          GROUP BY j.id
          ORDER BY j.entry_date DESC, j.created_at DESC
          LIMIT $1 OFFSET $2`,
        [pageSize, (page - 1) * pageSize]
      );
      return { items: rows.rows, total: total.rows[0].n, page, pageSize };
    });

    res.json(out);
  }),
);

accountingRouter.get(
  '/vouchers/:id',
  requirePermission('accounting.vouchers.read'),
  asyncHandler(async (req, res) => {
    const tenantId = req.auth!.tenantId;
    const out = await withTenant(tenantId, async (db) => {
      const v = await db.query(
        `SELECT j.id, j.entry_number AS "entryNumber", j.entry_date AS "entryDate",
                j.voucher_type AS "voucherType", j.narration, j.reference, j.is_posted AS "isPosted",
                j.created_at AS "createdAt"
           FROM journal_entries j
          WHERE j.id = $1`,
        [req.params.id]
      );
      if (!v.rows[0]) throw notFound('Voucher not found');

      const lines = await db.query(
        `SELECT l.id, l.account_id AS "accountId", a.code AS "accountCode", a.name AS "accountName",
                l.debit, l.credit, l.description, l.line_number AS "lineNumber"
           FROM journal_entry_lines l
           JOIN accounts a ON a.id = l.account_id
          WHERE l.entry_id = $1
          ORDER BY l.line_number ASC`,
        [req.params.id]
      );

      return { ...v.rows[0], lines: lines.rows };
    });

    res.json(out);
  }),
);

accountingRouter.post(
  '/vouchers',
  requirePermission('accounting.vouchers.manage'),
  asyncHandler(async (req, res) => {
    const input = voucherCreateSchema.parse(req.body);
    const tenantId = req.auth!.tenantId;

    // Verify balance
    let totalDebit = 0;
    let totalCredit = 0;
    for (const l of input.lines) {
      totalDebit += l.debit;
      totalCredit += l.credit;
    }
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw badRequest(`Voucher is not balanced. Total Debit (${totalDebit.toFixed(2)}) must equal Total Credit (${totalCredit.toFixed(2)})`);
    }

    const out = await withTenant(tenantId, async (db) => {
      const entryNumber = await nextDocNumber(db, tenantId, 'journal_voucher');

      const r = await db.query(
        `INSERT INTO journal_entries (tenant_id, entry_number, entry_date, voucher_type, narration, reference, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, entry_number AS "entryNumber", entry_date AS "entryDate", voucher_type AS "voucherType"`,
        [tenantId, entryNumber, input.entryDate, input.voucherType, input.narration ?? null, input.reference ?? null, req.auth!.userId]
      );
      const entryId = r.rows[0].id;

      for (let i = 0; i < input.lines.length; i++) {
        const line = input.lines[i];
        await db.query(
          `INSERT INTO journal_entry_lines (tenant_id, entry_id, account_id, debit, credit, description, line_number)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [tenantId, entryId, line.accountId, line.debit, line.credit, line.description ?? null, i + 1]
        );
      }

      await writeAudit(db, {
        tenantId,
        userId: req.auth!.userId,
        action: 'voucher.create',
        entity: 'journal_entry',
        entityId: entryId,
        newValue: { entryNumber, ...input },
        ip: clientIp(req),
      });

      return { id: entryId, entryNumber, totalAmount: totalDebit };
    });

    res.status(201).json(out);
  }),
);

// -------------------------------------------------------------
// 3. General Ledger
// -------------------------------------------------------------
accountingRouter.get(
  '/ledger',
  requirePermission('accounting.reports.read'),
  asyncHandler(async (req, res) => {
    const tenantId = req.auth!.tenantId;
    const accountId = req.query.accountId as string;

    const out = await withTenant(tenantId, async (db) => {
      const where = accountId ? 'WHERE l.account_id = $1' : '';
      const params = accountId ? [accountId] : [];

      const rows = await db.query(
        `SELECT l.id, j.entry_date AS "entryDate", j.entry_number AS "entryNumber", j.voucher_type AS "voucherType",
                a.id AS "accountId", a.code AS "accountCode", a.name AS "accountName", a.type AS "accountType",
                l.debit, l.credit, COALESCE(l.description, j.narration) AS description
           FROM journal_entry_lines l
           JOIN journal_entries j ON j.id = l.entry_id AND j.is_posted = true
           JOIN accounts a ON a.id = l.account_id
          ${where}
          ORDER BY j.entry_date ASC, j.created_at ASC, l.line_number ASC`,
        params
      );

      // Compute running balance
      let running = 0;
      const items = rows.rows.map((row) => {
        const isAssetOrExpense = ['asset', 'expense'].includes(row.accountType);
        const change = isAssetOrExpense ? Number(row.debit) - Number(row.credit) : Number(row.credit) - Number(row.debit);
        running += change;
        return { ...row, runningBalance: running };
      });

      return items;
    });

    res.json(out);
  }),
);

// -------------------------------------------------------------
// 4. Trial Balance & Profit & Loss
// -------------------------------------------------------------
accountingRouter.get(
  '/reports/trial-balance',
  requirePermission('accounting.reports.read'),
  asyncHandler(async (req, res) => {
    const tenantId = req.auth!.tenantId;
    const out = await withTenant(tenantId, async (db) => {
      const rows = await db.query(
        `SELECT a.id, a.code, a.name, a.type,
                COALESCE(SUM(CASE WHEN j.is_posted = true THEN l.debit ELSE 0 END), 0)::numeric(14,2) AS "totalDebit",
                COALESCE(SUM(CASE WHEN j.is_posted = true THEN l.credit ELSE 0 END), 0)::numeric(14,2) AS "totalCredit"
           FROM accounts a
           LEFT JOIN journal_entry_lines l ON l.account_id = a.id
           LEFT JOIN journal_entries j ON j.id = l.entry_id
          GROUP BY a.id
          HAVING COALESCE(SUM(CASE WHEN j.is_posted = true THEN l.debit ELSE 0 END), 0) > 0 
              OR COALESCE(SUM(CASE WHEN j.is_posted = true THEN l.credit ELSE 0 END), 0) > 0
          ORDER BY a.code ASC`
      );

      let grandDebit = 0;
      let grandCredit = 0;
      const accounts = rows.rows.map((r) => {
        const d = Number(r.totalDebit);
        const c = Number(r.totalCredit);
        grandDebit += d;
        grandCredit += c;
        return {
          ...r,
          netDebit: d > c ? d - c : 0,
          netCredit: c > d ? c - d : 0,
        };
      });

      return { accounts, grandDebit, grandCredit, isBalanced: Math.abs(grandDebit - grandCredit) < 0.01 };
    });

    res.json(out);
  }),
);

accountingRouter.get(
  '/reports/income-statement',
  requirePermission('accounting.reports.read'),
  asyncHandler(async (req, res) => {
    const tenantId = req.auth!.tenantId;
    const out = await withTenant(tenantId, async (db) => {
      const revenues = await db.query(
        `SELECT a.code, a.name, COALESCE(SUM(CASE WHEN j.is_posted = true THEN l.credit - l.debit ELSE 0 END), 0)::numeric(14,2) AS amount
           FROM accounts a
           LEFT JOIN journal_entry_lines l ON l.account_id = a.id
           LEFT JOIN journal_entries j ON j.id = l.entry_id
          WHERE a.type = 'revenue'
          GROUP BY a.id
          ORDER BY a.code ASC`
      );

      const expenses = await db.query(
        `SELECT a.code, a.name, COALESCE(SUM(CASE WHEN j.is_posted = true THEN l.debit - l.credit ELSE 0 END), 0)::numeric(14,2) AS amount
           FROM accounts a
           LEFT JOIN journal_entry_lines l ON l.account_id = a.id
           LEFT JOIN journal_entries j ON j.id = l.entry_id
          WHERE a.type = 'expense'
          GROUP BY a.id
          ORDER BY a.code ASC`
      );

      const totalRevenue = revenues.rows.reduce((sum, r) => sum + Number(r.amount), 0);
      const totalExpense = expenses.rows.reduce((sum, r) => sum + Number(r.amount), 0);
      const netProfit = totalRevenue - totalExpense;

      return {
        revenues: revenues.rows,
        expenses: expenses.rows,
        totalRevenue,
        totalExpense,
        netProfit,
      };
    });

    res.json(out);
  }),
);

accountingRouter.post(
  '/vouchers/:id/reverse',
  asyncHandler(async (req, res) => {
    const { isOwner, userId, tenantId } = req.auth!;
    if (!isOwner) throw forbidden('Access denied. Only the company owner can reverse journal vouchers.');

    const { password, reason } = z.object({
      password: z.string().min(1, 'Owner password is required'),
      reason: z.string().trim().min(3, 'A valid reason for reversal is required'),
    }).parse(req.body);

    const out = await withTenant(tenantId, async (db) => {
      const userRes = await db.query('SELECT password_hash, is_owner FROM users WHERE id = $1', [userId]);
      const user = userRes.rows[0];
      if (!user?.is_owner) throw forbidden('Owner account required');

      const ok = await verifyPassword(password, user.password_hash);
      if (!ok) throw badRequest('Invalid owner password. Reversal authorization failed.');

      const jvRes = await db.query(
        'SELECT id, entry_number, voucher_type, is_posted FROM journal_entries WHERE id = $1',
        [req.params.id],
      );
      const jv = jvRes.rows[0];
      if (!jv) throw notFound('Journal voucher not found');
      if (!jv.is_posted) throw badRequest('Voucher is already unposted or reversed');

      await db.query(
        `UPDATE journal_entries
            SET is_posted = false, reversed_at = now(), reversed_by = $2, reversal_reason = $3,
                narration = COALESCE(narration, '') || ' [REVERSED by Owner: ' || $3 || ']'
          WHERE id = $1`,
        [req.params.id, userId, reason],
      );

      await writeAudit(db, {
        tenantId,
        userId,
        action: 'voucher.reverse',
        entity: 'journal_entry',
        entityId: req.params.id,
        newValue: { entryNumber: jv.entry_number, reason },
        ip: clientIp(req),
      });

      return {
        success: true,
        message: `Journal voucher ${jv.entry_number} reversed successfully.`,
      };
    });

    res.json(out);
  }),
);


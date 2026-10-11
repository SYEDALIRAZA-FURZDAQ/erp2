import { Router } from 'express';
import { z } from 'zod';
import { authenticate, clientIp, requirePermission } from '../../middleware/auth';
import { withTenant } from '../../db/pool';
import { asyncHandler, badRequest, forbidden, notFound } from '../../utils/errors';
import { writeAudit } from '../audit/audit.service';
import { verifyPassword } from '../../utils/password';

export const companyRouter = Router();
companyRouter.use(authenticate);

const opt = (max: number) => z.string().trim().max(max).nullish().transform((v) => (v ? v : null));

const schema = z.object({
  name: z.string().trim().min(2).max(120),
  legalName: opt(160),
  ntn: opt(20),
  strn: opt(30),
  cnic: opt(20),
  address: opt(300),
  city: opt(80),
  province: opt(80),
  phone: opt(40),
  email: z.string().trim().email().nullish().or(z.literal('')).transform((v) => (v ? v : null)),
  baseCurrency: z.string().trim().toUpperCase().length(3).default('PKR'),
  fiscalYearStartMonth: z.number().int().min(1).max(12).default(7),
  workingDays: z.array(z.string().toLowerCase()).default(['monday', 'tuesday', 'wednesday', 'thursday', 'friday']),
  saturdayRule: z.enum(['off', 'working', 'alternate_1_3', 'alternate_2_4', 'custom']).default('off'),
  workStartTime: z.string().regex(/^\d{2}:\d{2}$/, 'Must be in HH:MM format').default('09:00'),
  workEndTime: z.string().regex(/^\d{2}:\d{2}$/, 'Must be in HH:MM format').default('18:00'),
  lateGraceMinutes: z.number().int().min(0).max(120).default(15),
  halfDayHours: z.number().min(1).max(12).default(4.0),
});

const SELECT = `SELECT id, name, legal_name AS "legalName", ntn, strn, cnic, address, city, province, phone, email,
  base_currency AS "baseCurrency", fiscal_year_start_month AS "fiscalYearStartMonth",
  working_days AS "workingDays", saturday_rule AS "saturdayRule",
  work_start_time AS "workStartTime", work_end_time AS "workEndTime",
  late_grace_minutes AS "lateGraceMinutes", half_day_hours::float AS "halfDayHours"
  FROM companies ORDER BY created_at LIMIT 1`;

companyRouter.get(
  '/',
  requirePermission('core.settings.read'),
  asyncHandler(async (req, res) => {
    const r = await withTenant(req.auth!.tenantId, (db) => db.query(SELECT));
    res.json(r.rows[0]);
  }),
);

companyRouter.put(
  '/',
  requirePermission('core.settings.manage'),
  asyncHandler(async (req, res) => {
    const i = schema.parse(req.body);
    const { tenantId, userId } = req.auth!;
    const out = await withTenant(tenantId, async (db) => {
      const old = (await db.query(SELECT)).rows[0];
      await db.query(
        `UPDATE companies SET name=$2, legal_name=$3, ntn=$4, strn=$5, cnic=$6, address=$7, city=$8, province=$9,
           phone=$10, email=$11, base_currency=$12, fiscal_year_start_month=$13,
           working_days=$14, saturday_rule=$15, work_start_time=$16, work_end_time=$17,
           late_grace_minutes=$18, half_day_hours=$19, updated_at=now() WHERE id=$1`,
        [
          old.id,
          i.name,
          i.legalName,
          i.ntn,
          i.strn,
          i.cnic,
          i.address,
          i.city,
          i.province,
          i.phone,
          i.email,
          i.baseCurrency,
          i.fiscalYearStartMonth,
          i.workingDays,
          i.saturdayRule,
          i.workStartTime,
          i.workEndTime,
          i.lateGraceMinutes,
          i.halfDayHours,
        ],
      );
      await writeAudit(db, {
        tenantId,
        userId,
        action: 'company.update',
        entity: 'company',
        entityId: old.id,
        oldValue: old,
        newValue: i,
        ip: clientIp(req),
      });
      return (await db.query(SELECT)).rows[0];
    });
    res.json(out);
  }),
);

// ─── Owner Transaction Reversal Endpoints ────────────────────────────────────

/** Get reversible transactions (paid payrolls and posted journal vouchers) */
companyRouter.get(
  '/transactions/reversible',
  asyncHandler(async (req, res) => {
    const { tenantId } = req.auth!;
    const out = await withTenant(tenantId, async (db) => {
      const payrolls = await db.query(
        `SELECT id, run_number AS "runNumber", month, year, status,
                total_net AS "totalNet", total_gross AS "totalGross", payment_date AS "paymentDate",
                reversed_at AS "reversedAt", reversal_reason AS "reversalReason"
           FROM payroll_runs
          WHERE status = 'paid'
          ORDER BY year DESC, month DESC
          LIMIT 20`,
      );

      const vouchers = await db.query(
        `SELECT j.id, j.entry_number AS "entryNumber", j.entry_date AS "entryDate",
                j.voucher_type AS "voucherType", j.narration, j.reference, j.is_posted AS "isPosted",
                COALESCE(SUM(l.debit), 0)::numeric(14,2) AS "totalAmount"
           FROM journal_entries j
           LEFT JOIN journal_entry_lines l ON l.entry_id = j.id
          WHERE j.is_posted = true
          GROUP BY j.id
          ORDER BY j.entry_date DESC, j.created_at DESC
          LIMIT 30`,
      );

      return { payrolls: payrolls.rows, vouchers: vouchers.rows };
    });
    res.json(out);
  }),
);

const reverseSchema = z.object({
  transactionType: z.enum(['payroll', 'voucher']),
  id: z.string().uuid(),
  password: z.string().min(1, 'Owner password is required'),
  reason: z.string().trim().min(3, 'A valid reason for reversal is required'),
});

/** Authorize and reverse any transaction with owner password */
companyRouter.post(
  '/transactions/reverse',
  asyncHandler(async (req, res) => {
    const { tenantId, userId, isOwner } = req.auth!;
    const input = reverseSchema.parse(req.body);

    // 1. Strict Owner Authorization Check
    if (!isOwner) {
      throw forbidden('Access denied. Only the company owner can reverse transactions.');
    }

    const out = await withTenant(tenantId, async (db) => {
      // 2. Verify Owner Password against DB hash
      const userRes = await db.query('SELECT password_hash, is_owner FROM users WHERE id = $1', [userId]);
      const user = userRes.rows[0];
      if (!user || !user.is_owner) {
        throw forbidden('Unauthorized. Owner account required.');
      }

      const isValidPassword = await verifyPassword(input.password, user.password_hash);
      if (!isValidPassword) {
        throw badRequest('Invalid owner password. Reversal authorization failed.');
      }

      // 3. Process Reversal based on transaction type
      if (input.transactionType === 'payroll') {
        const prRes = await db.query(
          'SELECT id, run_number, month, year, status, total_gross, total_net FROM payroll_runs WHERE id = $1',
          [input.id],
        );
        const pr = prRes.rows[0];
        if (!pr) throw notFound('Payroll run not found');
        if (pr.status !== 'paid' && pr.status !== 'approved') {
          throw badRequest(`Cannot reverse payroll run with status '${pr.status}'`);
        }

        // Void / unpost any matching journal entries generated for this payroll run
        const jvRes = await db.query(
          `SELECT id, entry_number FROM journal_entries
            WHERE (reference = $1 OR narration LIKE $2) AND is_posted = true`,
          [pr.run_number, `%${pr.run_number}%`],
        );

        for (const jv of jvRes.rows) {
          await db.query(
            `UPDATE journal_entries
                SET is_posted = false, reversed_at = now(), reversed_by = $2, reversal_reason = $3,
                    narration = COALESCE(narration, '') || ' [REVERSED by Owner: ' || $3 || ']'
              WHERE id = $1`,
            [jv.id, userId, input.reason],
          );
        }

        // Restore payroll run back to draft
        await db.query(
          `UPDATE payroll_runs
              SET status = 'draft', payment_date = NULL, reversed_at = now(), reversed_by = $2, reversal_reason = $3
            WHERE id = $1`,
          [input.id, userId, input.reason],
        );

        await writeAudit(db, {
          tenantId,
          userId,
          action: 'payroll.reverse',
          entity: 'payroll_run',
          entityId: input.id,
          newValue: {
            runNumber: pr.run_number,
            unpostedVouchers: jvRes.rows.map((r: any) => r.entry_number),
            reason: input.reason,
            restoredStatus: 'draft',
          },
          ip: clientIp(req),
        });

        return {
          success: true,
          message: `Payroll run ${pr.run_number} reversed back to Draft. Linked journal vouchers voided.`,
          unpostedVouchersCount: jvRes.rowCount,
        };
      } else if (input.transactionType === 'voucher') {
        const jvRes = await db.query(
          'SELECT id, entry_number, voucher_type, reference, narration, is_posted FROM journal_entries WHERE id = $1',
          [input.id],
        );
        const jv = jvRes.rows[0];
        if (!jv) throw notFound('Journal voucher not found');
        if (!jv.is_posted) throw badRequest('Voucher is already unposted / reversed');

        await db.query(
          `UPDATE journal_entries
              SET is_posted = false, reversed_at = now(), reversed_by = $2, reversal_reason = $3,
                  narration = COALESCE(narration, '') || ' [REVERSED by Owner: ' || $3 || ']'
            WHERE id = $1`,
          [input.id, userId, input.reason],
        );

        // Synchronize source documents:
        // 1. If this voucher is linked to a sales invoice, cancel the invoice and restore deducted inventory
        const ref = jv.reference;
        const narr = jv.narration || '';
        const invRes = await db.query(
          `SELECT id, invoice_number FROM sales_invoices
            WHERE (invoice_number = $1 AND $1 IS NOT NULL)
               OR ($2 != '' AND $2 LIKE '%' || invoice_number || '%')`,
          [ref, narr],
        );
        for (const inv of invRes.rows) {
          await db.query(`UPDATE sales_invoices SET status = 'cancelled' WHERE id = $1`, [inv.id]);
          await db.query(
            `DELETE FROM stock_movements WHERE reference = $1 AND notes = 'Sales Invoice Sale'`,
            [inv.invoice_number],
          );
        }

        // 2. If this voucher is linked to a purchase bill, cancel the bill and restore received inventory
        const billRes = await db.query(
          `SELECT id, bill_number FROM purchase_bills
            WHERE (bill_number = $1 AND $1 IS NOT NULL)
               OR ($2 != '' AND $2 LIKE '%' || bill_number || '%')`,
          [ref, narr],
        );
        for (const bill of billRes.rows) {
          await db.query(`UPDATE purchase_bills SET status = 'cancelled' WHERE id = $1`, [bill.id]);
          await db.query(
            `DELETE FROM stock_movements WHERE reference = $1 AND notes = 'Purchase Goods Receipt'`,
            [bill.bill_number],
          );
        }

        await writeAudit(db, {
          tenantId,
          userId,
          action: 'voucher.reverse',
          entity: 'journal_entry',
          entityId: input.id,
          newValue: { entryNumber: jv.entry_number, reason: input.reason },
          ip: clientIp(req),
        });

        return {
          success: true,
          message: `Journal voucher ${jv.entry_number} reversed successfully. Linked invoice/bill status synchronized.`,
        };
      }

      throw badRequest('Unsupported transaction type');
    });

    res.json(out);
  }),
);


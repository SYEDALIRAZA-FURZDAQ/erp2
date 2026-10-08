import { Router } from 'express';
import { z } from 'zod';
import { authenticate, clientIp, requirePermission } from '../../middleware/auth';
import { withTenant } from '../../db/pool';
import { asyncHandler, badRequest, forbidden, notFound } from '../../utils/errors';
import { writeAudit } from '../audit/audit.service';
import { nextDocNumber } from '../numbering/numbering.service';
import { verifyPassword } from '../../utils/password';

export const hrRouter = Router();
hrRouter.use(authenticate);

// -------------------------------------------------------------
// 1. Employees Master
// -------------------------------------------------------------
const employeeSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  cnic: z.string().trim().min(10).max(25),
  email: z.string().trim().email().nullish().or(z.literal('')),
  phone: z.string().trim().max(30).nullish(),
  department: z.string().trim().min(2).max(100),
  designation: z.string().trim().min(2).max(100),
  joiningDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).default(() => new Date().toISOString().slice(0, 10)),
  basicSalary: z.coerce.number().min(0),
  medicalAllowance: z.coerce.number().min(0).default(0),
  conveyanceAllowance: z.coerce.number().min(0).default(0),
  bankAccount: z.string().trim().max(50).nullish(),
});

hrRouter.get(
  '/employees',
  requirePermission('hr.employees.read'),
  asyncHandler(async (req, res) => {
    const tenantId = req.auth!.tenantId;
    const out = await withTenant(tenantId, async (db) => {
      const rows = await db.query(
        `SELECT e.id, e.employee_code AS "employeeCode", e.full_name AS "fullName", e.cnic,
                e.email, e.phone, e.department, e.designation, e.joining_date AS "joiningDate",
                e.basic_salary AS "basicSalary", e.medical_allowance AS "medicalAllowance",
                e.conveyance_allowance AS "conveyanceAllowance", e.bank_account AS "bankAccount",
                e.status, e.created_at AS "createdAt"
           FROM employees e
          ORDER BY e.employee_code ASC`
      );
      return rows.rows;
    });
    res.json(out);
  }),
);

hrRouter.post(
  '/employees',
  requirePermission('hr.employees.manage'),
  asyncHandler(async (req, res) => {
    const input = employeeSchema.parse(req.body);
    const tenantId = req.auth!.tenantId;

    const out = await withTenant(tenantId, async (db) => {
      let code = '';
      try {
        code = await nextDocNumber(db, tenantId, 'employee');
      } catch {
        code = `EMP-${Date.now().toString().slice(-5)}`;
      }

      const r = await db.query(
        `INSERT INTO employees (
          tenant_id, employee_code, full_name, cnic, email, phone, department, designation,
          joining_date, basic_salary, medical_allowance, conveyance_allowance, bank_account
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING id, employee_code AS "employeeCode", full_name AS "fullName"`,
        [
          tenantId,
          code,
          input.fullName,
          input.cnic,
          input.email || null,
          input.phone || null,
          input.department,
          input.designation,
          input.joiningDate,
          input.basicSalary,
          input.medicalAllowance,
          input.conveyanceAllowance,
          input.bankAccount || null,
        ]
      );

      await writeAudit(db, {
        tenantId,
        userId: req.auth!.userId,
        action: 'employee.create',
        entity: 'employee',
        entityId: r.rows[0].id,
        newValue: input,
        ip: clientIp(req),
      });

      return r.rows[0];
    });

    res.status(201).json(out);
  }),
);

hrRouter.put(
  '/employees/:id',
  requirePermission('hr.employees.manage'),
  asyncHandler(async (req, res) => {
    const input = employeeSchema.extend({
      status: z.enum(['active', 'on_leave', 'terminated', 'resigned']).default('active'),
    }).parse(req.body);
    const tenantId = req.auth!.tenantId;

    const out = await withTenant(tenantId, async (db) => {
      const existing = await db.query(
        'SELECT id, employee_code, full_name, basic_salary FROM employees WHERE id = $1',
        [req.params.id]
      );
      if (!existing.rows[0]) throw notFound('Employee not found');

      const r = await db.query(
        `UPDATE employees
            SET full_name = $1, cnic = $2, email = $3, phone = $4,
                department = $5, designation = $6, joining_date = $7,
                basic_salary = $8, medical_allowance = $9, conveyance_allowance = $10,
                bank_account = $11, status = $12
          WHERE id = $13
          RETURNING id, employee_code AS "employeeCode", full_name AS "fullName", cnic,
                    email, phone, department, designation, joining_date AS "joiningDate",
                    basic_salary AS "basicSalary", medical_allowance AS "medicalAllowance",
                    conveyance_allowance AS "conveyanceAllowance", bank_account AS "bankAccount",
                    status`,
        [
          input.fullName,
          input.cnic,
          input.email || null,
          input.phone || null,
          input.department,
          input.designation,
          input.joiningDate,
          input.basicSalary,
          input.medicalAllowance,
          input.conveyanceAllowance,
          input.bankAccount || null,
          input.status,
          req.params.id,
        ]
      );

      await writeAudit(db, {
        tenantId,
        userId: req.auth!.userId,
        action: 'employee.update',
        entity: 'employee',
        entityId: req.params.id,
        oldValue: existing.rows[0],
        newValue: input,
        ip: clientIp(req),
      });

      return r.rows[0];
    });

    res.json(out);
  }),
);

// -------------------------------------------------------------
// 2. Payroll Generation & Payslips
// -------------------------------------------------------------
export function calculateMonthlyPakistanTax(monthlyGross: number): number {
  const annual = monthlyGross * 12;
  let annualTax = 0;
  if (annual <= 600_000) {
    annualTax = 0;
  } else if (annual <= 1_200_000) {
    annualTax = (annual - 600_000) * 0.05;
  } else if (annual <= 2_200_000) {
    annualTax = 30_000 + (annual - 1_200_000) * 0.15;
  } else if (annual <= 3_200_000) {
    annualTax = 180_000 + (annual - 2_200_000) * 0.25;
  } else if (annual <= 4_100_000) {
    annualTax = 430_000 + (annual - 3_200_000) * 0.30;
  } else {
    annualTax = 700_000 + (annual - 4_100_000) * 0.35;
  }
  return Math.round(annualTax / 12);
}

const payrollGenerateSchema = z.object({
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2020),
});

hrRouter.get(
  '/payroll',
  requirePermission('hr.payroll.read'),
  asyncHandler(async (req, res) => {
    const tenantId = req.auth!.tenantId;
    const out = await withTenant(tenantId, async (db) => {
      const rows = await db.query(
        `SELECT pr.id, pr.run_number AS "runNumber", pr.month, pr.year, pr.status,
                pr.total_gross AS "totalGross", pr.total_tax AS "totalTax",
                pr.total_eobi AS "totalEobi", pr.total_net AS "totalNet",
                pr.payment_date AS "paymentDate", pr.created_at AS "createdAt",
                pr.reversed_at AS "reversedAt", pr.reversal_reason AS "reversalReason",
                pr.declined_at AS "declinedAt", pr.decline_reason AS "declineReason",
                COUNT(ps.id)::int AS "employeeCount"
           FROM payroll_runs pr
           LEFT JOIN payslips ps ON ps.payroll_run_id = pr.id
          GROUP BY pr.id
          ORDER BY pr.year DESC, pr.month DESC`
      );
      return rows.rows;
    });
    res.json(out);
  }),
);

hrRouter.get(
  '/payroll/:id',
  requirePermission('hr.payroll.read'),
  asyncHandler(async (req, res) => {
    const tenantId = req.auth!.tenantId;
    const out = await withTenant(tenantId, async (db) => {
      const pr = await db.query(
        `SELECT pr.id, pr.run_number AS "runNumber", pr.month, pr.year, pr.status,
                pr.total_gross AS "totalGross", pr.total_tax AS "totalTax",
                pr.total_eobi AS "totalEobi", pr.total_net AS "totalNet",
                pr.payment_date AS "paymentDate",
                pr.reversed_at AS "reversedAt", pr.reversal_reason AS "reversalReason",
                pr.declined_at AS "declinedAt", pr.decline_reason AS "declineReason"
           FROM payroll_runs pr
          WHERE pr.id = $1`,
        [req.params.id]
      );
      if (!pr.rows[0]) throw notFound('Payroll run not found');

      const payslips = await db.query(
        `SELECT ps.id, ps.employee_id AS "employeeId", ps.basic_salary AS "basicSalary",
                ps.allowances, ps.gross_salary AS "grossSalary", ps.income_tax AS "incomeTax",
                ps.eobi_deduction AS "eobiDeduction", ps.net_salary AS "netSalary",
                e.employee_code AS "employeeCode", e.full_name AS "fullName",
                e.cnic, e.department, e.designation, e.bank_account AS "bankAccount"
           FROM payslips ps
           JOIN employees e ON e.id = ps.employee_id
          WHERE ps.payroll_run_id = $1
          ORDER BY e.employee_code ASC`,
        [req.params.id]
      );

      return { ...pr.rows[0], payslips: payslips.rows };
    });

    res.json(out);
  }),
);

hrRouter.post(
  '/payroll/generate',
  requirePermission('hr.payroll.manage'),
  asyncHandler(async (req, res) => {
    const { month, year } = payrollGenerateSchema.parse(req.body);
    const tenantId = req.auth!.tenantId;

    const out = await withTenant(tenantId, async (db) => {
      const existing = await db.query('SELECT id FROM payroll_runs WHERE month = $1 AND year = $2', [month, year]);
      if (existing.rowCount) throw badRequest(`Payroll for ${month}/${year} has already been generated`);

      const employees = await db.query(
        `SELECT id, basic_salary, medical_allowance, conveyance_allowance
           FROM employees
          WHERE status = 'active'`
      );
      if (employees.rowCount === 0) throw badRequest('No active employees found to generate payroll');

      const runNumber = `PR-${year}-${String(month).padStart(2, '0')}`;
      let totalGross = 0;
      let totalTax = 0;
      let totalEobi = 0;
      let totalNet = 0;

      const run = await db.query(
        `INSERT INTO payroll_runs (tenant_id, run_number, month, year, status)
         VALUES ($1, $2, $3, $4, 'draft')
         RETURNING id`,
        [tenantId, runNumber, month, year]
      );
      const runId = run.rows[0].id;

      for (const emp of employees.rows) {
        const basic = Number(emp.basic_salary);
        const allowances = Number(emp.medical_allowance) + Number(emp.conveyance_allowance);
        const gross = basic + allowances;
        const tax = calculateMonthlyPakistanTax(gross);
        const eobi = 370; // Standard Pakistan EOBI employee monthly deduction
        const net = gross - tax - eobi;

        totalGross += gross;
        totalTax += tax;
        totalEobi += eobi;
        totalNet += net;

        await db.query(
          `INSERT INTO payslips (
            tenant_id, payroll_run_id, employee_id, basic_salary, allowances,
            gross_salary, income_tax, eobi_deduction, net_salary
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [tenantId, runId, emp.id, basic, allowances, gross, tax, eobi, net]
        );
      }

      await db.query(
        `UPDATE payroll_runs
            SET total_gross = $1, total_tax = $2, total_eobi = $3, total_net = $4
          WHERE id = $5`,
        [totalGross, totalTax, totalEobi, totalNet, runId]
      );

      await writeAudit(db, {
        tenantId,
        userId: req.auth!.userId,
        action: 'payroll.generate',
        entity: 'payroll_run',
        entityId: runId,
        newValue: { runNumber, month, year, totalNet, employeeCount: employees.rowCount },
        ip: clientIp(req),
      });

      return { id: runId, runNumber, totalNet, employeeCount: employees.rowCount };
    });

    res.status(201).json(out);
  }),
);

async function ensurePayrollAccounts(db: any, tenantId: string) {
  const defaults = [
    { code: '6010', name: 'Salaries & Wages', type: 'expense', subtype: 'operating_expense' },
    { code: '1020', name: 'Bank - Meezan Bank Current', type: 'asset', subtype: 'current_asset' },
    { code: '2030', name: 'Payroll / Withholding Tax Payable', type: 'liability', subtype: 'current_liability' },
    { code: '2040', name: 'EOBI & Social Security Payable', type: 'liability', subtype: 'current_liability' },
  ];

  for (const acc of defaults) {
    await db.query(
      `INSERT INTO accounts (tenant_id, code, name, type, subtype)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (tenant_id, code) DO NOTHING`,
      [tenantId, acc.code, acc.name, acc.type, acc.subtype]
    );
  }

  const [sal, bank, tax, eobi] = await Promise.all([
    db.query("SELECT id FROM accounts WHERE code = '6010' LIMIT 1"),
    db.query("SELECT id FROM accounts WHERE code = '1020' LIMIT 1"),
    db.query("SELECT id FROM accounts WHERE code = '2030' LIMIT 1"),
    db.query("SELECT id FROM accounts WHERE code = '2040' LIMIT 1"),
  ]);

  return {
    salExpId: sal.rows[0]?.id,
    bankAccId: bank.rows[0]?.id,
    taxAccId: tax.rows[0]?.id,
    eobiAccId: eobi.rows[0]?.id,
  };
}

hrRouter.post(
  '/payroll/:id/status',
  requirePermission('hr.payroll.manage'),
  asyncHandler(async (req, res) => {
    const { status, reason } = z.object({
      status: z.enum(['draft', 'approved', 'paid', 'declined']),
      reason: z.string().trim().optional(),
    }).parse(req.body);
    const tenantId = req.auth!.tenantId;
    const userId = req.auth!.userId;

    await withTenant(tenantId, async (db) => {
      const prRes = await db.query(
        'SELECT run_number, total_gross, total_tax, total_eobi, total_net, status FROM payroll_runs WHERE id = $1',
        [req.params.id]
      );
      const pr = prRes.rows[0];
      if (!pr) throw notFound('Payroll run not found');

      if (status === 'declined') {
        // Void any linked posted vouchers if it was previously disbursed
        const jvRes = await db.query(
          `SELECT id, entry_number FROM journal_entries
            WHERE (reference = $1 OR narration LIKE $2) AND is_posted = true`,
          [pr.run_number, `%${pr.run_number}%`],
        );
        for (const jv of jvRes.rows) {
          await db.query(
            `UPDATE journal_entries
                SET is_posted = false, reversed_at = now(), reversed_by = $2, reversal_reason = $3,
                    narration = COALESCE(narration, '') || ' [DECLINED: ' || $3 || ']'
              WHERE id = $1`,
            [jv.id, userId, reason || 'Payroll Run Declined'],
          );
        }

        await db.query(
          `UPDATE payroll_runs
              SET status = 'declined', payment_date = NULL, declined_at = now(), declined_by = $2, decline_reason = $3
            WHERE id = $1`,
          [req.params.id, userId, reason || 'Declined during review'],
        );
      } else if (status === 'approved') {
        await db.query(
          `UPDATE payroll_runs
              SET status = 'approved', declined_at = NULL, declined_by = NULL, decline_reason = NULL
            WHERE id = $1`,
          [req.params.id],
        );
      } else if (status === 'paid') {
        // Ensure chart of accounts has all required payroll ledger accounts
        const accounts = await ensurePayrollAccounts(db, tenantId);

        // Check if journal voucher already exists to prevent duplicate disbursements
        const existingJv = await db.query(
          `SELECT id FROM journal_entries WHERE reference = $1 AND is_posted = true LIMIT 1`,
          [pr.run_number]
        );

        if (!existingJv.rowCount && accounts.salExpId && accounts.bankAccId) {
          const jvNum = await nextDocNumber(db, tenantId, 'journal_voucher');
          const jv = await db.query(
            `INSERT INTO journal_entries (tenant_id, entry_number, entry_date, voucher_type, narration, reference, is_posted, created_by)
             VALUES ($1, $2, CURRENT_DATE, 'JV', $3, $4, true, $5) RETURNING id`,
            [tenantId, jvNum, `Payroll Disbursement ${pr.run_number}`, pr.run_number, userId]
          );
          const jvId = jv.rows[0].id;
          let lineNum = 1;

          // 1. Debit Gross Salary Expense
          await db.query(
            `INSERT INTO journal_entry_lines (tenant_id, entry_id, account_id, debit, credit, description, line_number)
             VALUES ($1, $2, $3, $4, 0, $5, $6)`,
            [tenantId, jvId, accounts.salExpId, pr.total_gross, 'Gross Salary Expense', lineNum++]
          );

          // 2. Credit Income Tax Withholding Payable (if tax was deducted)
          if (accounts.taxAccId && Number(pr.total_tax) > 0) {
            await db.query(
              `INSERT INTO journal_entry_lines (tenant_id, entry_id, account_id, debit, credit, description, line_number)
               VALUES ($1, $2, $3, 0, $4, $5, $6)`,
              [tenantId, jvId, accounts.taxAccId, pr.total_tax, 'Salary Income Tax Withheld', lineNum++]
            );
          }

          // 3. Credit EOBI & Social Security Deduction Payable (if EOBI was deducted)
          if (accounts.eobiAccId && Number(pr.total_eobi) > 0) {
            await db.query(
              `INSERT INTO journal_entry_lines (tenant_id, entry_id, account_id, debit, credit, description, line_number)
               VALUES ($1, $2, $3, 0, $4, $5, $6)`,
              [tenantId, jvId, accounts.eobiAccId, pr.total_eobi, 'EOBI Social Security Deduction', lineNum++]
            );
          }

          // 4. Credit Bank Account with Net Salary Payout
          await db.query(
            `INSERT INTO journal_entry_lines (tenant_id, entry_id, account_id, debit, credit, description, line_number)
             VALUES ($1, $2, $3, 0, $4, $5, $6)`,
            [tenantId, jvId, accounts.bankAccId, pr.total_net, 'Net Salary Payout via Bank', lineNum++]
          );
        }

        await db.query(
          `UPDATE payroll_runs
              SET status = 'paid', payment_date = CURRENT_DATE, declined_at = NULL, declined_by = NULL, decline_reason = NULL
            WHERE id = $1`,
          [req.params.id]
        );
      } else {
        // draft
        await db.query(
          `UPDATE payroll_runs
              SET status = 'draft', payment_date = NULL
            WHERE id = $1`,
          [req.params.id]
        );
      }

      await writeAudit(db, {
        tenantId,
        userId,
        action: 'payroll.update_status',
        entity: 'payroll_run',
        entityId: req.params.id,
        newValue: { status, reason },
        ip: clientIp(req),
      });
    });

    res.json({ success: true, status });
  }),
);

hrRouter.post(
  '/payroll/:id/reverse',
  asyncHandler(async (req, res) => {
    const { isOwner, userId, tenantId } = req.auth!;
    if (!isOwner) throw forbidden('Access denied. Only the company owner can reverse payroll runs.');

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

      const prRes = await db.query(
        'SELECT id, run_number, month, year, status, total_gross, total_net FROM payroll_runs WHERE id = $1',
        [req.params.id],
      );
      const pr = prRes.rows[0];
      if (!pr) throw notFound('Payroll run not found');
      if (pr.status !== 'paid' && pr.status !== 'approved') {
        throw badRequest(`Cannot reverse payroll run with status '${pr.status}'`);
      }

      // Void / unpost matching journal entries generated for this payroll disbursement
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
          [jv.id, userId, reason],
        );
      }

      // Restore payroll run back to draft
      await db.query(
        `UPDATE payroll_runs
            SET status = 'draft', payment_date = NULL, reversed_at = now(), reversed_by = $2, reversal_reason = $3
          WHERE id = $1`,
        [req.params.id, userId, reason],
      );

      await writeAudit(db, {
        tenantId,
        userId,
        action: 'payroll.reverse',
        entity: 'payroll_run',
        entityId: req.params.id,
        newValue: {
          runNumber: pr.run_number,
          unpostedVouchers: jvRes.rows.map((r: any) => r.entry_number),
          reason,
          restoredStatus: 'draft',
        },
        ip: clientIp(req),
      });

      return {
        success: true,
        message: `Payroll run ${pr.run_number} reversed back to Draft. Linked journal vouchers voided in real time.`,
        unpostedVouchersCount: jvRes.rowCount,
      };
    });

    res.json(out);
  }),
);

hrRouter.delete(
  '/payroll/:id',
  requirePermission('hr.payroll.manage'),
  asyncHandler(async (req, res) => {
    const { isOwner, userId, tenantId } = req.auth!;
    if (!isOwner) throw forbidden('Access denied. Only the company owner can delete monthly payroll runs.');

    const { password } = z.object({
      password: z.string().min(1, 'Owner password is required to authorize payroll deletion'),
    }).parse(req.body);

    const out = await withTenant(tenantId, async (db) => {
      const userRes = await db.query('SELECT password_hash, is_owner FROM users WHERE id = $1', [userId]);
      const user = userRes.rows[0];
      if (!user?.is_owner) throw forbidden('Owner account required');

      const ok = await verifyPassword(password, user.password_hash);
      if (!ok) throw badRequest('Invalid owner password. Deletion authorization failed.');

      const prRes = await db.query(
        'SELECT id, run_number, month, year, status FROM payroll_runs WHERE id = $1',
        [req.params.id]
      );
      const pr = prRes.rows[0];
      if (!pr) throw notFound('Payroll run not found');

      // Purge any linked journal vouchers created for this payroll run so accounting data stays 100% aligned
      const linkedJvs = await db.query(
        'SELECT id, entry_number FROM journal_entries WHERE reference = $1 OR narration LIKE $2',
        [pr.run_number, `%${pr.run_number}%`]
      );
      if (linkedJvs.rows.length > 0) {
        const jvIds = linkedJvs.rows.map((r: any) => r.id);
        await db.query('DELETE FROM journal_entry_lines WHERE entry_id = ANY($1)', [jvIds]);
        await db.query('DELETE FROM journal_entries WHERE id = ANY($1)', [jvIds]);
      }

      // Delete payslips for this run
      await db.query('DELETE FROM payslips WHERE payroll_run_id = $1', [req.params.id]);

      // Delete the payroll run itself
      await db.query('DELETE FROM payroll_runs WHERE id = $1', [req.params.id]);

      await writeAudit(db, {
        tenantId,
        userId,
        action: 'payroll.delete',
        entity: 'payroll_run',
        entityId: req.params.id,
        newValue: {
          runNumber: pr.run_number,
          month: pr.month,
          year: pr.year,
          deletedJvs: linkedJvs.rows.map((r: any) => r.entry_number),
        },
        ip: clientIp(req),
      });

      return {
        success: true,
        message: `Monthly payroll run ${pr.run_number} (${pr.month}/${pr.year}) and linked accounting entries deleted successfully. You can now adjust employee basic pay/allowances and regenerate this month's payroll.`,
      };
    });

    res.json(out);
  }),
);


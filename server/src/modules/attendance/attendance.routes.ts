import { Router } from 'express';
import { z } from 'zod';
import { authenticate, clientIp, requirePermission } from '../../middleware/auth';
import { withTenant } from '../../db/pool';
import { asyncHandler, notFound } from '../../utils/errors';
import { writeAudit } from '../audit/audit.service';

export const attendanceRouter = Router();
attendanceRouter.use(authenticate);

// -------------------------------------------------------------
// 1. Attendance Records
// -------------------------------------------------------------
const attendanceRecordSchema = z.object({
  employeeId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).default(() => new Date().toISOString().slice(0, 10)),
  checkIn:  z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).nullish(),  // accepts string | null | undefined
  checkOut: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).nullish(),
  status: z.enum(['present', 'absent', 'late', 'half_day', 'on_leave']).default('present'),
  remarks: z.string().trim().max(255).nullish(),
});

attendanceRouter.get(
  '/records',
  requirePermission('attendance.records.read'),
  asyncHandler(async (req, res) => {
    const tenantId = req.auth!.tenantId;
    const date = (req.query.date as string) || new Date().toISOString().slice(0, 10);

    const out = await withTenant(tenantId, async (db) => {
      const rows = await db.query(
        `SELECT a.id, e.id AS "employeeId", a.date, a.check_in AS "checkIn",
                a.check_out AS "checkOut", a.status, a.remarks,
                e.employee_code AS "employeeCode", e.full_name AS "fullName",
                e.department, e.designation
           FROM employees e
           LEFT JOIN attendance a ON a.employee_id = e.id AND a.date = $1
          WHERE e.status = 'active'
          ORDER BY e.employee_code ASC`,
        [date]
      );
      return rows.rows;
    });
    res.json(out);
  }),
);

attendanceRouter.post(
  '/records',
  requirePermission('attendance.records.manage'),
  asyncHandler(async (req, res) => {
    const input = attendanceRecordSchema.parse(req.body);
    const tenantId = req.auth!.tenantId;

    const out = await withTenant(tenantId, async (db) => {
      const r = await db.query(
        `INSERT INTO attendance (tenant_id, employee_id, date, check_in, check_out, status, remarks)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (tenant_id, employee_id, date)
         DO UPDATE SET
           check_in = COALESCE(EXCLUDED.check_in, attendance.check_in),
           check_out = COALESCE(EXCLUDED.check_out, attendance.check_out),
           status = EXCLUDED.status,
           remarks = EXCLUDED.remarks
         RETURNING id, status, date`,
        [
          tenantId,
          input.employeeId,
          input.date,
          input.checkIn || null,
          input.checkOut || null,
          input.status,
          input.remarks || null,
        ]
      );

      await writeAudit(db, {
        tenantId,
        userId: req.auth!.userId,
        action: 'attendance.record',
        entity: 'attendance',
        entityId: r.rows[0].id,
        newValue: input,
        ip: clientIp(req),
      });

      return r.rows[0];
    });

    res.json(out);
  }),
);

// -------------------------------------------------------------
// 2. Leave Management
// -------------------------------------------------------------
const leaveSchema = z.object({
  employeeId: z.string().uuid(),
  leaveType: z.enum(['annual', 'casual', 'sick', 'unpaid']),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().trim().min(2).max(300),
});

attendanceRouter.get(
  '/leaves',
  requirePermission('attendance.leaves.read'),
  asyncHandler(async (req, res) => {
    const tenantId = req.auth!.tenantId;
    const out = await withTenant(tenantId, async (db) => {
      const rows = await db.query(
        `SELECT l.id, l.employee_id AS "employeeId", l.leave_type AS "leaveType",
                l.start_date AS "startDate", l.end_date AS "endDate", l.reason,
                l.status, l.created_at AS "createdAt",
                e.employee_code AS "employeeCode", e.full_name AS "fullName",
                e.department, e.designation
           FROM leave_requests l
           JOIN employees e ON e.id = l.employee_id
          ORDER BY l.created_at DESC`
      );
      return rows.rows;
    });
    res.json(out);
  }),
);

attendanceRouter.post(
  '/leaves',
  requirePermission('attendance.leaves.manage'),
  asyncHandler(async (req, res) => {
    const input = leaveSchema.parse(req.body);
    const tenantId = req.auth!.tenantId;

    const out = await withTenant(tenantId, async (db) => {
      const r = await db.query(
        `INSERT INTO leave_requests (tenant_id, employee_id, leave_type, start_date, end_date, reason)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, leave_type AS "leaveType", status`,
        [tenantId, input.employeeId, input.leaveType, input.startDate, input.endDate, input.reason]
      );

      await writeAudit(db, {
        tenantId,
        userId: req.auth!.userId,
        action: 'leave.request',
        entity: 'leave_request',
        entityId: r.rows[0].id,
        newValue: input,
        ip: clientIp(req),
      });

      return r.rows[0];
    });

    res.status(201).json(out);
  }),
);

attendanceRouter.post(
  '/leaves/:id/status',
  requirePermission('attendance.leaves.manage'),
  asyncHandler(async (req, res) => {
    const { status } = z.object({ status: z.enum(['approved', 'rejected']) }).parse(req.body);
    const tenantId = req.auth!.tenantId;

    await withTenant(tenantId, async (db) => {
      const r = await db.query('UPDATE leave_requests SET status = $1 WHERE id = $2 RETURNING id', [status, req.params.id]);
      if (!r.rowCount) throw notFound('Leave request not found');

      await writeAudit(db, {
        tenantId,
        userId: req.auth!.userId,
        action: 'leave.update_status',
        entity: 'leave_request',
        entityId: req.params.id,
        newValue: { status },
        ip: clientIp(req),
      });
    });

    res.json({ success: true, status });
  }),
);

// -------------------------------------------------------------
// 4. Monthly calendar view for a single employee
// -------------------------------------------------------------
attendanceRouter.get(
  '/monthly',
  requirePermission('attendance.records.read'),
  asyncHandler(async (req, res) => {
    const tenantId = req.auth!.tenantId;
    const { employeeId, year, month } = req.query as Record<string, string>;

    if (!employeeId || !year || !month) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'employeeId, year, month required' } });
    }

    const out = await withTenant(tenantId, async (db) => {
      const rows = await db.query(
        `SELECT a.date::text, a.status, a.check_in AS "checkIn", a.check_out AS "checkOut", a.remarks
           FROM attendance a
          WHERE a.employee_id = $1
            AND EXTRACT(YEAR  FROM a.date) = $2
            AND EXTRACT(MONTH FROM a.date) = $3
          ORDER BY a.date ASC`,
        [employeeId, Number(year), Number(month)]
      );
      return rows.rows;
    });
    res.json(out);
  }),
);

// -------------------------------------------------------------
// 5. Clock-out  PATCH /records/:employeeId/:date/checkout
// -------------------------------------------------------------
attendanceRouter.patch(
  '/records/:employeeId/:date/checkout',
  requirePermission('attendance.records.manage'),
  asyncHandler(async (req, res) => {
    const { checkOut } = z.object({ checkOut: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/) }).parse(req.body);
    const tenantId = req.auth!.tenantId;

    const out = await withTenant(tenantId, async (db) => {
      const r = await db.query(
        `UPDATE attendance SET check_out = $1
          WHERE employee_id = $2 AND date = $3 AND tenant_id = $4
          RETURNING id, check_out AS "checkOut"`,
        [checkOut, req.params.employeeId, req.params.date, tenantId]
      );
      if (!r.rowCount) throw notFound('Attendance record not found');

      await writeAudit(db, {
        tenantId,
        userId: req.auth!.userId,
        action: 'attendance.checkout',
        entity: 'attendance',
        entityId: r.rows[0].id,
        newValue: { checkOut },
        ip: clientIp(req),
      });

      return r.rows[0];
    });
    res.json(out);
  }),
);

attendanceRouter.get(
  '/summary',
  requirePermission('attendance.records.read'),
  asyncHandler(async (req, res) => {
    const tenantId = req.auth!.tenantId;
    // Use local date (passed from client) or fall back to a timezone-aware server date
    const clientToday = (req.query.date as string) || (() => {
      const now = new Date();
      const y = now.getFullYear();
      const mo = String(now.getMonth() + 1).padStart(2, '0');
      const d  = String(now.getDate()).padStart(2, '0');
      return `${y}-${mo}-${d}`;
    })();
    const today = clientToday;

    const out = await withTenant(tenantId, async (db) => {
      const totalEmp = await db.query("SELECT count(*)::int AS n FROM employees WHERE status = 'active'");
      const stats = await db.query(
        `SELECT status, count(*)::int AS n
           FROM attendance
          WHERE date = $1
          GROUP BY status`,
        [today]
      );

      const map: Record<string, number> = { present: 0, absent: 0, late: 0, half_day: 0, on_leave: 0 };
      for (const row of stats.rows) {
        map[row.status] = row.n;
      }

      return {
        totalEmployees: totalEmp.rows[0].n,
        today,
        ...map,
      };
    });

    res.json(out);
  }),
);

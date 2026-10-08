import { Router } from 'express';
import { z } from 'zod';
import { authenticate, clientIp, requirePermission } from '../../middleware/auth';
import { withTenant } from '../../db/pool';
import { asyncHandler, notFound } from '../../utils/errors';
import { writeAudit } from '../audit/audit.service';
import { nextDocNumber } from '../numbering/numbering.service';

export const projectsRouter = Router();
projectsRouter.use(authenticate);

// -------------------------------------------------------------
// 1. Projects Master
// -------------------------------------------------------------
const projectSchema = z.object({
  name: z.string().trim().min(2).max(150),
  clientId: z.string().uuid().nullish(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).default(() => new Date().toISOString().slice(0, 10)),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  budget: z.coerce.number().min(0).default(0),
  status: z.enum(['planning', 'in_progress', 'on_hold', 'completed', 'cancelled']).default('planning'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  progressPercent: z.coerce.number().int().min(0).max(100).default(0),
});

projectsRouter.get(
  '/',
  requirePermission('projects.manage.read'),
  asyncHandler(async (req, res) => {
    const tenantId = req.auth!.tenantId;
    const out = await withTenant(tenantId, async (db) => {
      const rows = await db.query(
        `SELECT p.id, p.code, p.name, p.start_date AS "startDate", p.end_date AS "endDate",
                p.budget, p.status, p.priority, p.progress_percent AS "progressPercent",
                p.created_at AS "createdAt",
                c.id AS "clientId", c.name AS "clientName",
                COUNT(DISTINCT pt.id)::int AS "taskCount",
                COUNT(DISTINCT CASE WHEN pt.status = 'done' THEN pt.id END)::int AS "completedTaskCount",
                COALESCE(SUM(ts.hours), 0)::numeric(5,2) AS "totalHoursLogged",
                COALESCE(SUM(ts.expense_amount), 0)::numeric(14,2) AS "totalExpensesLogged"
           FROM projects p
           LEFT JOIN customers c ON c.id = p.client_id
           LEFT JOIN project_tasks pt ON pt.project_id = p.id
           LEFT JOIN project_timesheets ts ON ts.project_id = p.id
          GROUP BY p.id, c.id
          ORDER BY p.created_at DESC`
      );
      return rows.rows;
    });
    res.json(out);
  }),
);

projectsRouter.get(
  '/:id',
  requirePermission('projects.manage.read'),
  asyncHandler(async (req, res) => {
    const tenantId = req.auth!.tenantId;
    const out = await withTenant(tenantId, async (db) => {
      const prj = await db.query(
        `SELECT p.id, p.code, p.name, p.start_date AS "startDate", p.end_date AS "endDate",
                p.budget, p.status, p.priority, p.progress_percent AS "progressPercent",
                p.created_at AS "createdAt",
                c.id AS "clientId", c.name AS "clientName"
           FROM projects p
           LEFT JOIN customers c ON c.id = p.client_id
          WHERE p.id = $1`,
        [req.params.id]
      );
      if (!prj.rows[0]) throw notFound('Project not found');

      const tasks = await db.query(
        `SELECT pt.id, pt.title, pt.due_date AS "dueDate", pt.status, pt.priority,
                pt.created_at AS "createdAt",
                e.id AS "assignedToId", e.full_name AS "assignedToName"
           FROM project_tasks pt
           LEFT JOIN employees e ON e.id = pt.assigned_to
          WHERE pt.project_id = $1
          ORDER BY pt.created_at DESC`,
        [req.params.id]
      );

      const timesheets = await db.query(
        `SELECT ts.id, ts.date, ts.hours, ts.expense_amount AS "expenseAmount", ts.description,
                ts.created_at AS "createdAt",
                e.id AS "employeeId", e.full_name AS "employeeName"
           FROM project_timesheets ts
           LEFT JOIN employees e ON e.id = ts.employee_id
          WHERE ts.project_id = $1
          ORDER BY ts.date DESC, ts.created_at DESC`,
        [req.params.id]
      );

      return { ...prj.rows[0], tasks: tasks.rows, timesheets: timesheets.rows };
    });

    res.json(out);
  }),
);

projectsRouter.post(
  '/',
  requirePermission('projects.manage.manage'),
  asyncHandler(async (req, res) => {
    const input = projectSchema.parse(req.body);
    const tenantId = req.auth!.tenantId;

    const out = await withTenant(tenantId, async (db) => {
      let code = '';
      try {
        code = await nextDocNumber(db, tenantId, 'project');
      } catch {
        code = `PRJ-${Date.now().toString().slice(-5)}`;
      }

      const r = await db.query(
        `INSERT INTO projects (tenant_id, code, name, client_id, start_date, end_date, budget, status, priority, progress_percent)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id, code, name`,
        [
          tenantId,
          code,
          input.name,
          input.clientId || null,
          input.startDate,
          input.endDate || null,
          input.budget,
          input.status,
          input.priority,
          input.progressPercent,
        ]
      );

      await writeAudit(db, {
        tenantId,
        userId: req.auth!.userId,
        action: 'project.create',
        entity: 'project',
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
// 2. Project Tasks
// -------------------------------------------------------------
const taskCreateSchema = z.object({
  title: z.string().trim().min(2).max(200),
  assignedTo: z.string().uuid().nullish(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
});

projectsRouter.post(
  '/:id/tasks',
  requirePermission('projects.tasks.manage'),
  asyncHandler(async (req, res) => {
    const input = taskCreateSchema.parse(req.body);
    const tenantId = req.auth!.tenantId;
    const projectId = req.params.id;

    const out = await withTenant(tenantId, async (db) => {
      const r = await db.query(
        `INSERT INTO project_tasks (tenant_id, project_id, title, assigned_to, due_date, priority)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, title, status, priority`,
        [tenantId, projectId, input.title, input.assignedTo || null, input.dueDate || null, input.priority]
      );

      await writeAudit(db, {
        tenantId,
        userId: req.auth!.userId,
        action: 'project_task.create',
        entity: 'project_task',
        entityId: r.rows[0].id,
        newValue: input,
        ip: clientIp(req),
      });

      return r.rows[0];
    });

    res.status(201).json(out);
  }),
);

projectsRouter.patch(
  '/tasks/:taskId',
  requirePermission('projects.tasks.manage'),
  asyncHandler(async (req, res) => {
    const { status } = z.object({ status: z.enum(['todo', 'in_progress', 'review', 'done']) }).parse(req.body);
    const tenantId = req.auth!.tenantId;

    await withTenant(tenantId, async (db) => {
      const r = await db.query('UPDATE project_tasks SET status = $1 WHERE id = $2 RETURNING id', [status, req.params.taskId]);
      if (!r.rowCount) throw notFound('Task not found');
    });

    res.json({ success: true, status });
  }),
);

// -------------------------------------------------------------
// 3. Project Timesheets & Expenses
// -------------------------------------------------------------
const timesheetSchema = z.object({
  employeeId: z.string().uuid().nullish(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).default(() => new Date().toISOString().slice(0, 10)),
  hours: z.coerce.number().positive(),
  expenseAmount: z.coerce.number().min(0).default(0),
  description: z.string().trim().min(2).max(300),
});

projectsRouter.post(
  '/:id/timesheets',
  requirePermission('projects.timesheets.manage'),
  asyncHandler(async (req, res) => {
    const input = timesheetSchema.parse(req.body);
    const tenantId = req.auth!.tenantId;
    const projectId = req.params.id;

    const out = await withTenant(tenantId, async (db) => {
      const r = await db.query(
        `INSERT INTO project_timesheets (tenant_id, project_id, employee_id, date, hours, expense_amount, description)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, hours, expense_amount AS "expenseAmount"`,
        [tenantId, projectId, input.employeeId || null, input.date, input.hours, input.expenseAmount, input.description]
      );

      await writeAudit(db, {
        tenantId,
        userId: req.auth!.userId,
        action: 'timesheet.log',
        entity: 'project_timesheet',
        entityId: r.rows[0].id,
        newValue: input,
        ip: clientIp(req),
      });

      return r.rows[0];
    });

    res.status(201).json(out);
  }),
);

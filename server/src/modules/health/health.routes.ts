import { Router } from 'express';
import { pool } from '../../db/pool';

export const healthRouter = Router();

healthRouter.get('/', async (_req, res) => {
  const mem = process.memoryUsage();
  let db = 'ok';
  try {
    await pool.query('SELECT 1');
  } catch {
    db = 'down';
  }
  res.status(db === 'ok' ? 200 : 503).json({
    status: db === 'ok' ? 'ok' : 'degraded',
    db,
    uptimeSec: Math.round(process.uptime()),
    memoryMB: { rss: Math.round(mem.rss / 1048576), heapUsed: Math.round(mem.heapUsed / 1048576) },
    pool: { total: pool.totalCount, idle: pool.idleCount, waiting: pool.waitingCount },
  });
});

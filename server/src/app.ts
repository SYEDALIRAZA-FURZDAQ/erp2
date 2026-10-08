import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import fs from 'fs';
import helmet from 'helmet';
import path from 'path';
import pinoHttp from 'pino-http';
import { env } from './config/env';
import { logger } from './config/logger';
import { errorHandler } from './utils/errors';
import { auditRouter } from './modules/audit/audit.routes';
import { authRouter } from './modules/auth/auth.routes';
import { companyRouter } from './modules/company/company.routes';
import { healthRouter } from './modules/health/health.routes';
import { numberingRouter } from './modules/numbering/numbering.routes';
import { rolesRouter } from './modules/roles/roles.routes';
import { usersRouter } from './modules/users/users.routes';
import { accountingRouter } from './modules/accounting/accounting.routes';
import { salesRouter } from './modules/sales/sales.routes';
import { inventoryRouter } from './modules/inventory/inventory.routes';
import { purchaseRouter } from './modules/purchase/purchase.routes';
import { hrRouter } from './modules/hr/hr.routes';
import { attendanceRouter } from './modules/attendance/attendance.routes';
import { assetsRouter } from './modules/assets/assets.routes';
import { projectsRouter } from './modules/projects/projects.routes';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1); // cPanel / LiteSpeed / Nginx sit in front
  app.disable('x-powered-by');

  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/api/v1/health' } }));
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'", 'data:'],
          frameAncestors: ["'none'"],
        },
      },
    }),
  );
  if (env.corsOrigins.length) app.use(cors({ origin: env.corsOrigins, credentials: true }));
  app.use(compression());
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  // ---- API v1 ----
  const api = express.Router();
  api.use('/health', healthRouter);
  api.use('/auth', authRouter);
  api.use('/users', usersRouter);
  api.use('/roles', rolesRouter);
  api.use('/audit', auditRouter);
  api.use('/numbering', numberingRouter);
  api.use('/company', companyRouter);

  // Business Modules
  api.use('/accounting', accountingRouter);
  api.use('/sales', salesRouter);
  api.use('/inventory', inventoryRouter);
  api.use('/purchase', purchaseRouter);
  api.use('/hr', hrRouter);
  api.use('/attendance', attendanceRouter);
  api.use('/assets', assetsRouter);
  api.use('/projects', projectsRouter);

  api.use((_req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Unknown API route' } }));
  app.use('/api/v1', api);

  // ---- Built React app (same origin => no CORS, no CSRF surface for the API) ----
  const webDist = path.resolve(__dirname, '../../web/dist');
  if (env.SERVE_WEB && fs.existsSync(path.join(webDist, 'index.html'))) {
    app.use('/assets', express.static(path.join(webDist, 'assets'), { immutable: true, maxAge: '1y' }));
    app.use(express.static(webDist, { maxAge: '1h' }));
    app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(webDist, 'index.html')));
  }

  app.use(errorHandler);
  return app;
}

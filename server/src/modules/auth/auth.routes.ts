import { Request, Response, Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../../config/env';
import { authenticate } from '../../middleware/auth';
import { asyncHandler } from '../../utils/errors';
import * as svc from './auth.service';

export const authRouter = Router();

const limiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: env.NODE_ENV === 'test' ? 1000 : 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many requests, slow down.' } },
});

const COOKIE = 'erp_rt';
const cookieOpts = (expires?: Date) => ({
  httpOnly: true,
  secure: env.COOKIE_SECURE,
  sameSite: 'strict' as const,
  path: '/api/v1/auth',
  expires,
});

const meta = (req: Request) => ({ ip: req.ip, userAgent: req.get('user-agent') });

function sendSession(res: Response, out: Awaited<ReturnType<typeof svc.login>>) {
  res.cookie(COOKIE, out.refresh.cookieValue, cookieOpts(out.refresh.expires));
  res.json(out.session);
}

authRouter.post(
  '/register-tenant',
  limiter,
  asyncHandler(async (req, res) => {
    const input = svc.registerSchema.parse(req.body);
    const out = await svc.registerTenant(input, meta(req));
    res.status(201).json(out);
  }),
);

authRouter.post(
  '/login',
  limiter,
  asyncHandler(async (req, res) => {
    sendSession(res, await svc.login(svc.loginSchema.parse(req.body), meta(req)));
  }),
);

authRouter.post(
  '/refresh',
  limiter,
  asyncHandler(async (req, res) => {
    sendSession(res, await svc.refresh(req.cookies?.[COOKIE], meta(req)));
  }),
);

authRouter.post(
  '/logout',
  asyncHandler(async (req, res) => {
    await svc.logout(req.cookies?.[COOKIE]);
    res.clearCookie(COOKIE, cookieOpts());
    res.json({ ok: true });
  }),
);

authRouter.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    res.json(await svc.me(req.auth!.tenantId, req.auth!.userId));
  }),
);

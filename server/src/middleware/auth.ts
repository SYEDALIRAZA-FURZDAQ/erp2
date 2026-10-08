import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { withTenant } from '../db/pool';
import { forbidden, unauthorized } from '../utils/errors';
import { hasPermission } from '../modules/roles/permissions';

export interface AuthContext {
  userId: string;
  tenantId: string;
  isOwner: boolean;
  permissions: string[];
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

export function signAccessToken(userId: string, tenantId: string): string {
  return jwt.sign({ sub: userId, tid: tenantId }, env.JWT_ACCESS_SECRET, {
    expiresIn: `${env.ACCESS_TOKEN_TTL_MIN}m`,
  });
}

export async function loadPermissions(tenantId: string, userId: string) {
  return withTenant(tenantId, async (db) => {
    const u = await db.query('SELECT is_owner, is_active FROM users WHERE id = $1', [userId]);
    if (!u.rows[0] || !u.rows[0].is_active) return null;
    const p = await db.query(
      `SELECT DISTINCT rp.permission FROM user_roles ur
         JOIN role_permissions rp ON rp.role_id = ur.role_id WHERE ur.user_id = $1`,
      [userId],
    );
    return { isOwner: u.rows[0].is_owner as boolean, permissions: p.rows.map((r) => r.permission as string) };
  });
}

/** Verifies the Bearer access token and loads the user's current permissions from the DB. */
export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw unauthorized();
    let payload: jwt.JwtPayload;
    try {
      payload = jwt.verify(header.slice(7), env.JWT_ACCESS_SECRET) as jwt.JwtPayload;
    } catch {
      throw unauthorized('Session expired');
    }
    const tenantId = payload.tid as string;
    const userId = payload.sub as string;
    const loaded = await loadPermissions(tenantId, userId);
    if (!loaded) throw unauthorized('Account is disabled');
    req.auth = { userId, tenantId, isOwner: loaded.isOwner, permissions: loaded.permissions };
    next();
  } catch (e) {
    next(e);
  }
}

/** Permission gate. Checked in the route layer AND again by services where data scope matters. */
export const requirePermission =
  (...required: string[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    const auth = req.auth;
    if (!auth) return next(unauthorized());
    if (!required.every((r) => hasPermission(auth.permissions, r))) return next(forbidden());
    next();
  };

export const clientIp = (req: Request) => req.ip ?? null;

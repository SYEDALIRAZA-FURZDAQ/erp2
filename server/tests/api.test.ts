// Integration tests: need a real PostgreSQL. Set TEST_DATABASE_URL to run them (skipped otherwise).
// WARNING: they create tenants in that database; use a throwaway database.
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

suite('API + tenant isolation', () => {
  let app: import('express').Express;
  let pool: import('pg').Pool;
  const stamp = Date.now().toString(36);
  const pw = 'Passw0rdTest';

  async function signup(slug: string) {
    const r = await request(app)
      .post('/api/v1/auth/register-tenant')
      .send({ companyName: `Co ${slug}`, slug, fullName: 'Owner One', email: `owner@${slug}.test`, password: pw });
    expect(r.status).toBe(201);
    const l = await request(app).post('/api/v1/auth/login').send({ tenant: slug, email: `owner@${slug}.test`, password: pw });
    expect(l.status).toBe(200);
    return { token: l.body.accessToken as string, cookie: l.headers['set-cookie'] as unknown as string[], tenantId: r.body.tenantId as string };
  }

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    process.env.JWT_ACCESS_SECRET = 'a'.repeat(48);
    process.env.JWT_REFRESH_SECRET = 'b'.repeat(48);
    process.env.NODE_ENV = 'test';
    const { migrate } = await import('../src/db/migrate');
    await migrate();
    ({ pool } = await import('../src/db/pool'));
    app = (await import('../src/app')).createApp();
  });
  afterAll(async () => {
    await pool?.end();
  });

  it('keeps tenants isolated (API level)', async () => {
    const a = await signup(`alpha-${stamp}`);
    const b = await signup(`beta-${stamp}`);
    const ua = await request(app).get('/api/v1/users').set('Authorization', `Bearer ${a.token}`);
    const ub = await request(app).get('/api/v1/users').set('Authorization', `Bearer ${b.token}`);
    expect(ua.body.items.map((u: { email: string }) => u.email)).toEqual([`owner@alpha-${stamp}.test`]);
    expect(ub.body.items.map((u: { email: string }) => u.email)).toEqual([`owner@beta-${stamp}.test`]);
  });

  it('enforces isolation in the database itself (RLS), even for raw queries', async () => {
    const { withTenant } = await import('../src/db/pool');
    const a = await signup(`gamma-${stamp}`);
    const b = await signup(`delta-${stamp}`);
    const seenByA = await withTenant(a.tenantId, (db) => db.query('SELECT tenant_id FROM users'));
    expect(seenByA.rows.every((r) => r.tenant_id === a.tenantId)).toBe(true);
    // A tenant context cannot write rows for another tenant
    await expect(
      withTenant(a.tenantId, (db) =>
        db.query("INSERT INTO roles (tenant_id, name) VALUES ($1, 'sneaky')", [b.tenantId]),
      ),
    ).rejects.toThrow();
    // No tenant context at all => nothing visible
    const c = await pool.query('SELECT count(*)::int AS n FROM users');
    expect(c.rows[0].n).toBe(0);
  });

  it('requires permission and rejects bad tokens', async () => {
    const t = await signup(`eps-${stamp}`);
    expect((await request(app).get('/api/v1/users')).status).toBe(401);
    expect((await request(app).get('/api/v1/users').set('Authorization', 'Bearer nope')).status).toBe(401);

    const role = await request(app).post('/api/v1/roles').set('Authorization', `Bearer ${t.token}`).send({ name: 'Viewer', permissions: ['core.settings.read'] });
    expect(role.status).toBe(201);
    const user = await request(app).post('/api/v1/users').set('Authorization', `Bearer ${t.token}`).send({
      email: `v@eps-${stamp}.test`, fullName: 'View Only', password: pw, roleIds: [role.body.id],
    });
    expect(user.status).toBe(201);
    const login = await request(app).post('/api/v1/auth/login').send({ tenant: `eps-${stamp}`, email: `v@eps-${stamp}.test`, password: pw });
    const denied = await request(app).get('/api/v1/users').set('Authorization', `Bearer ${login.body.accessToken}`);
    expect(denied.status).toBe(403);
    const allowed = await request(app).get('/api/v1/company').set('Authorization', `Bearer ${login.body.accessToken}`);
    expect(allowed.status).toBe(200);
  });

  it('rotates refresh tokens and detects reuse', async () => {
    const t = await signup(`zeta-${stamp}`);
    const r1 = await request(app).post('/api/v1/auth/refresh').set('Cookie', t.cookie);
    expect(r1.status).toBe(200);
    const reuse = await request(app).post('/api/v1/auth/refresh').set('Cookie', t.cookie);
    expect(reuse.status).toBe(401);
    const newer = await request(app).post('/api/v1/auth/refresh').set('Cookie', r1.headers['set-cookie'] as unknown as string[]);
    expect(newer.status).toBe(401); // whole family revoked after reuse
  });

  it('locks the account after repeated failures', async () => {
    const slug = `eta-${stamp}`;
    await signup(slug);
    for (let i = 0; i < 5; i++) {
      await request(app).post('/api/v1/auth/login').send({ tenant: slug, email: `owner@${slug}.test`, password: 'wrong-pass-1' });
    }
    const r = await request(app).post('/api/v1/auth/login').send({ tenant: slug, email: `owner@${slug}.test`, password: pw });
    expect(r.status).toBe(403);
  });
});

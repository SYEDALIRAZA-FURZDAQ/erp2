# Deploying ERP-PERN on cPanel (shared hosting)

This guide targets a cPanel account with **Setup Node.js App** and **PostgreSQL Databases** (the tools visible in
your cPanel: Software > Setup Node.js App, Databases > PostgreSQL Databases / PostgreSQL Database Wizard / phpPgAdmin).
The Node app serves both the API and the React front end from one domain.

> The code has not been executed yet (see README). Do the local verification there **before** deploying, so you are
> not debugging code and hosting at the same time.

Menu names differ slightly between cPanel themes and versions. If a button is labelled a little differently, the
intent is the same.

---

## 0. Know your limits

| Limit (from your cPanel) | Why it matters |
|---|---|
| ~1 GB RAM, 100 processes, 20 entry processes | One Node process only. Never build the front end on the server. |
| Shared IP | If FBR requires IP allow-listing you will need a dedicated IP or a VPS. |
| PostgreSQL available, MongoDB not | This project uses PostgreSQL only. |

## 1. Build the release on your computer

You need Node.js 18+ on your own machine.

```bash
npm install
npm run typecheck && npm test
npm run package            # runs scripts/package-release.sh
```

Result: `release/erp-pern-release.zip` containing `server/dist`, `server/migrations`, `web/dist`, a slim
`package.json` (runtime dependencies only), `.env.example` and these docs. It does not contain `node_modules`.

On Windows, run the script from Git Bash or WSL, or run the steps by hand: `npm install`, `npm run build`, then zip
`server/dist`, `server/migrations`, `web/dist` and the release `package.json` as described in the script.

## 2. Create the PostgreSQL database

cPanel prefixes every database and user name with your account name (shown as `<cpuser>` below).

1. cPanel > **PostgreSQL Database Wizard**.
2. Create the database, for example `erpdb` (it becomes `<cpuser>_erpdb`).
3. Create a user, for example `erpuser` (becomes `<cpuser>_erpuser`) with a strong password. Prefer letters and
   numbers; if you use symbols you must URL-encode them in the connection string (`@` becomes `%40`, `#` becomes `%23`).
4. Add the user to the database with **ALL PRIVILEGES**.
5. Note the connection string:

```
postgres://<cpuser>_erpuser:<password>@localhost:5432/<cpuser>_erpdb
```

6. Open **phpPgAdmin**, run `SELECT version();` and confirm the server is **PostgreSQL 13 or newer** (the schema uses
   `gen_random_uuid()`). On older versions, run `CREATE EXTENSION IF NOT EXISTS pgcrypto;` as the database owner
   and tell me, because the migration may need a small adjustment.

## 3. Upload and extract

1. cPanel > **File Manager**. In your home directory (not `public_html`) create a folder `erp`.
2. Upload `erp-pern-release.zip` into `erp/` and **Extract** it there.
3. You should now have `~/erp/package.json`, `~/erp/server/dist/server.js`, `~/erp/server/migrations/`,
   `~/erp/web/dist/index.html`.

Keeping the app outside `public_html` stops source files and `.env` from being served as static files.

## 4. Create the Node.js application

1. cPanel > Software > **Setup Node.js App** > **Create Application**.
2. Fill in:

| Field | Value |
|---|---|
| Node.js version | newest LTS offered (18, 20 or 22) |
| Application mode | **Production** |
| Application root | `erp` |
| Application URL | the domain or subdomain, e.g. `erp.yourdomain.com` (create the subdomain first under Domains if needed) |
| Application startup file | `server/dist/server.js` |

3. Click **Create**.

## 5. Configure the environment

Create `~/erp/.env` in File Manager (**+ File**, name it `.env`, then **Edit**). The app reads `.env` from the
application root, and this also works for the migration script and SSH. Use the template from `.env.example`:

```ini
NODE_ENV=production
DATABASE_URL=postgres://<cpuser>_erpuser:<password>@localhost:5432/<cpuser>_erpdb
DB_POOL_MAX=5
DB_SSL=false
JWT_ACCESS_SECRET=<96 random hex chars>
JWT_REFRESH_SECRET=<a different 96 random hex chars>
COOKIE_SECURE=true
SERVE_WEB=true
ALLOW_TENANT_SIGNUP=true
```

Generate each secret on your computer: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.

Set the file permission to `600` (File Manager > right-click > Change Permissions). Never commit this file or send it
by email. (You can alternatively add the same variables in the Node.js App screen under **Environment variables**;
use one method, not both.)

## 6. Install dependencies and create the tables

On the Node.js App screen for your application:

1. Click **Run NPM Install**. It installs runtime dependencies only and should take a minute or two.
2. Run the migration, either way:
   - **Run JS script**: choose the script `migrate` (it runs `node server/dist/db/migrate.js`), or
   - **SSH / Terminal**, using the command shown at the top of the app screen ("Enter to the virtual environment"):

```bash
source ~/nodevenv/erp/<node-version>/bin/activate && cd ~/erp
npm run migrate
```

You should see `applied 001_core.sql`. Running it again prints `Database is up to date.`

If you see `permission denied for schema public`, your PostgreSQL user does not own the database's public schema.
In phpPgAdmin, as the database owner, run `GRANT ALL ON SCHEMA public TO "<cpuser>_erpuser";`, then migrate again.

## 7. Start and verify

1. On the Node.js App screen click **Restart**.
2. Visit `https://erp.yourdomain.com/api/v1/health`. Expected:

```json
{ "status": "ok", "db": "ok", "uptimeSec": 3, "memoryMB": { "rss": 80, "heapUsed": 25 }, "pool": { ... } }
```

3. Visit `https://erp.yourdomain.com/register` and create **your own company**. You are signed in as its Owner.
4. If you prefer to onboard customers yourself, set `ALLOW_TENANT_SIGNUP=false` in `.env` and click **Restart**.
   (Create customer companies first from a signed-up state, or temporarily re-enable sign-up when onboarding.)

## 8. HTTPS

cPanel > Security > **SSL/TLS Status** > run **AutoSSL** for the domain/subdomain (the "Let's Encrypt SSL" tool also
works). The app sets `Secure` cookies, so serve it over HTTPS only and keep `COOKIE_SECURE=true`.

## 9. How customers reach the app

In this phase every customer signs in at the same URL with their **company code** (the code chosen at sign-up), their
email and password. Their data is isolated by tenant (PostgreSQL row-level security).

Per-customer subdomains (`client1.yourdomain.com`) or custom domains are a later enhancement: they need DNS/SSL per
domain, and wildcard subdomains usually need a wildcard certificate that shared hosting often does not offer.

## 10. Backups (you hold customers' financial data)

1. Enable **JetBackup** (Files > JetBackup 5) schedules for the account and its databases.
2. Add a nightly `pg_dump` via **Cron Jobs**. First create `~/.pgpass` (permission `600`) with one line:
   `localhost:5432:<cpuser>_erpdb:<cpuser>_erpuser:<password>`
   and the folder `~/backups`. Then add a daily cron job (note the escaped `%` signs, required in cron):

```
pg_dump -h localhost -U <cpuser>_erpuser <cpuser>_erpdb | gzip > $HOME/backups/erp-$(date +\%F).sql.gz && find $HOME/backups -name 'erp-*.sql.gz' -mtime +14 -delete
```

3. **Copy backups off the server** regularly (another host or cloud storage). A backup that lives only on the same
   server does not protect you from losing the server.
4. **Test a restore** into a scratch database before you depend on it: `gunzip -c erp-DATE.sql.gz | psql ...`.

## 11. Updating to a new version

1. Build a new release zip on your computer.
2. Back up first (run the pg_dump command once by hand).
3. In File Manager, upload and extract over `~/erp` (overwrite files). **Do not delete `.env`.**
4. If `package.json` dependencies changed, click **Run NPM Install**.
5. Run the `migrate` script (safe to run every time; it only applies new files).
6. Click **Restart** and check `/api/v1/health`.

Rollback: restore the previous zip's files and, if a migration ran, restore the database backup from step 2.

## 12. Troubleshooting

| Symptom | Likely cause and fix |
|---|---|
| Site shows a Passenger / 500 error page | Check the **Application startup file** is exactly `server/dist/server.js`, and look at the error log (`~/erp/stderr.log` or the Node.js App screen's log link). |
| Log says `Invalid environment configuration` | A required variable is missing or secrets are shorter than 32 characters. Fix `.env`, Restart. |
| `password authentication failed` | Wrong `DATABASE_URL` password, or special characters not URL-encoded. |
| `ECONNREFUSED` to the database | Use host `localhost` and port `5432`. Confirm the user is attached to the database. |
| `permission denied for schema public` | See the GRANT command in step 6. |
| Login works, but you are logged out on refresh | `COOKIE_SECURE=true` while visiting over plain HTTP. Use HTTPS. |
| `/api/v1/health` works but pages are blank/404 | `web/dist/index.html` missing, or `SERVE_WEB=false`. Re-extract the release. |
| "Resource limit reached" / 508 | You hit the 1 GB RAM or process cap. Keep `DB_POOL_MAX` at 5, and consider a VPS. |
| Changes not visible after upload | Click **Restart** on the Node.js App screen, and hard-refresh the browser. |

## 13. Security checklist

- [ ] `.env` outside `public_html`, permission 600, strong unique JWT secrets
- [ ] HTTPS active and `COOKIE_SECURE=true`
- [ ] PostgreSQL user has access only to the ERP database
- [ ] `ALLOW_TENANT_SIGNUP=false` if you onboard customers manually
- [ ] Backups scheduled, copied off-server, and a restore tested
- [ ] cPanel and SSH use strong passwords with 2FA enabled
- [ ] Do not enable remote PostgreSQL access unless you need it, and restrict it by IP

## 14. Moving to a VPS later (no code changes)

The same code runs on any Ubuntu server with Node.js and PostgreSQL:

```bash
# on the VPS
git clone <your repo> && cd erp-pern && npm install && npm run build
cp .env.example server/.env   # edit values
npm run migrate -w server
npm i -g pm2 && pm2 start server/dist/server.js --name erp && pm2 save && pm2 startup
```

Put Nginx in front (reverse proxy to port 3000) with a Let's Encrypt certificate. Move data with
`pg_dump` / `psql`. A VPS also gives you a dedicated IP, more RAM for concurrent customers, and wildcard
subdomains for per-customer URLs.

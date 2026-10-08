#!/usr/bin/env bash
# Builds server + web and produces release/erp-pern-release.zip for upload to cPanel.
# Run on YOUR computer (not on the shared host): the build needs more RAM than cPanel allows.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> Installing dependencies"
npm install --no-audit --no-fund

echo "==> Type-checking and building"
npm run build

echo "==> Assembling release"
rm -rf release && mkdir -p release/stage/server release/stage/web
cp -r server/dist server/migrations release/stage/server/
cp server/package.json release/stage/server/
cp package-lock.json release/stage/ 2>/dev/null || true
cp -r web/dist release/stage/web/
cp .env.example release/stage/.env.example
cp DEPLOYMENT.md README.md release/stage/

# Root package.json for the cPanel Node.js App: installs ONLY the server's runtime dependencies.
cat > release/stage/package.json <<'JSON'
{
  "name": "erp-pern-release",
  "version": "0.1.0",
  "private": true,
  "main": "server/dist/server.js",
  "scripts": {
    "start": "node server/dist/server.js",
    "migrate": "node server/dist/db/migrate.js"
  },
  "dependencies": __DEPS__
}
JSON
DEPS=$(node -e "console.log(JSON.stringify(require('./server/package.json').dependencies,null,2))")
node -e "
const fs=require('fs');const p='release/stage/package.json';
fs.writeFileSync(p, fs.readFileSync(p,'utf8').replace('__DEPS__', process.argv[1]));
" "$DEPS"
rm -f release/stage/package-lock.json   # lock file belongs to the workspace, not this flattened package

(cd release/stage && zip -qr ../erp-pern-release.zip .)
rm -rf release/stage
echo "==> Done: release/erp-pern-release.zip"

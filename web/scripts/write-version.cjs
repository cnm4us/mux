#!/usr/bin/env node
/*
  Generates a build id and writes:
    - web/public/version.json  { buildId, builtAt }
    - web/.env.local           VITE_BUILD_ID=...

  Usage: run as a prebuild step. Uses git SHA if available, else timestamp.
*/
const { execSync } = require('node:child_process');
const { writeFileSync, mkdirSync } = require('node:fs');
const { join } = require('node:path');

function utcStamp(d = new Date()) {
  const pad = n => String(n).padStart(2, '0');
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    'T' + pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + pad(d.getUTCSeconds()) + 'Z'
  );
}

function envBuildId() {
  const fromEnv = process.env.BUILD_ID && String(process.env.BUILD_ID).trim();
  if (fromEnv) return fromEnv;
  const base = process.env.VITE_BASE && String(process.env.VITE_BASE).trim();
  if (base) {
    const m = base.match(/\/b\/([^/]+)\//);
    if (m && m[1]) return m[1];
  }
  return null;
}

function fallbackBuildId() {
  const ts = utcStamp();
  let sha = '';
  try {
    sha = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString().trim();
  } catch {}
  // Always include timestamp so builds from the same commit produce unique IDs
  return sha ? `${sha}-${ts}` : ts;
}

const buildId = envBuildId() || fallbackBuildId();
const builtAt = new Date().toISOString();

const root = __dirname + '/..';
const publicDir = join(root, 'public');
try { mkdirSync(publicDir, { recursive: true }); } catch {}

// version.json consumed by SW and app
writeFileSync(join(publicDir, 'version.json'), JSON.stringify({ buildId, builtAt }), 'utf8');

// .env.local consumed by Vite (HTML env replacement)
const envLocal = `VITE_BUILD_ID=${buildId}\n`;
writeFileSync(join(root, '.env.local'), envLocal, 'utf8');

console.log(`[build-id] buildId=${buildId} builtAt=${builtAt}`);

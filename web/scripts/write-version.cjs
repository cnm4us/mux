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

function getBuildId() {
  try {
    const sha = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString().trim();
    if (sha) return sha;
  } catch {}
  return String(Date.now());
}

const buildId = process.env.VITE_BUILD_ID || getBuildId();
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


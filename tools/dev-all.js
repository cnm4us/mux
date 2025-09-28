#!/usr/bin/env node
// Run API and Web dev servers concurrently with prefixed output
const { spawn } = require('node:child_process');
const readline = require('node:readline');

function run(label, cmd, args, opts = {}) {
  const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], ...opts });
  const prefix = `[${label}]`;
  const rlOut = readline.createInterface({ input: child.stdout });
  rlOut.on('line', line => console.log(prefix, line));
  const rlErr = readline.createInterface({ input: child.stderr });
  rlErr.on('line', line => console.error(prefix, line));
  child.on('exit', (code, signal) => {
    console.log(`${prefix} exited (${signal || code})`);
  });
  return child;
}

const api = run('api', 'npm', ['-w', 'api', 'run', 'dev'], { env: process.env });
const web = run('web', 'npm', ['-w', 'web', 'run', 'dev'], { env: process.env });

function shutdown() {
  api.kill('SIGINT');
  web.kill('SIGINT');
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);


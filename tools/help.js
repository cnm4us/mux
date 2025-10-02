#!/usr/bin/env node
// Human-friendly help for npm scripts.
// Usage:
//   npm run help              -> list all scripts with 1-line descriptions
//   npm run help <script>     -> show detailed help + underlying command

const fs = require('node:fs');
const path = require('node:path');

function loadJSON(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

const root = path.resolve(__dirname, '..');
const pkgPath = path.join(root, 'package.json');
const pkg = loadJSON(pkgPath);
const scripts = pkg.scripts || {};
const meta = pkg.scriptsMeta || {};
const [, , arg] = process.argv;

function pad(str, len) {
  if (str.length >= len) return str;
  return str + ' '.repeat(len - str.length);
}

function listAll() {
  const names = Object.keys(scripts).sort((a, b) => a.localeCompare(b));
  console.log('\nAvailable scripts (npm run <name>):\n');
  const width = Math.min(32, Math.max(16, names.reduce((m, n) => Math.max(m, n.length), 0) + 2));
  for (const name of names) {
    const desc = (meta[name] && meta[name].desc) || '';
    console.log('  ' + pad(name, width) + desc);
  }
  console.log('\nTip: npm run help <script> for details on a specific command.\n');
}

function showOne(name) {
  if (scripts[name]) {
    const m = meta[name] || {};
    console.log(`\n${name}\n`);
    if (m.desc) console.log(m.desc + '\n');
    if (m.detail) console.log(m.detail + '\n');
    console.log('Command:');
    console.log(scripts[name] + '\n');
    return;
  }
  const names = Object.keys(scripts);
  const matches = names.filter(n => n.includes(name));
  if (matches.length) {
    console.log(`\nNo exact script named "${name}". Did you mean:\n`);
    for (const n of matches) console.log('  ' + n);
    console.log('');
  } else {
    console.log(`\nNo script named "${name}" found.\n`);
  }
}

if (!arg) listAll();
else showOne(arg);


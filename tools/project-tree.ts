#!/usr/bin/env node
/**
 * Project Tree & Symbol Summary
 * Scans a codebase and outputs:
 * - folder/file tree
 * - exported symbols (functions, consts, classes)
 * - likely React components (PascalCase functions) and default exports
 * - quick route hints for common dirs (app/, pages/, src/routes/)
 * - first leading JSDoc/top block comment as a file summary
 *
 * Usage:
 *   pnpm tsx tools/project-tree.ts --root . --out build/project-tree
 *   npx tsx tools/project-tree.ts --root . --md
 */

import fs from "node:fs";
import path from "node:path";
import * as ts from "typescript";
import { minimatch } from "minimatch";
import { execSync } from "node:child_process";
import ignore from "ignore";

type FileReport = {
  file: string;
  summary?: string;
  exports: {
    functions: string[];
    consts: string[];
    classes: string[];
    types: string[];
    interfaces: string[];
    enums: string[];
    defaultExport?: string;
  };
  react: {
    components: string[];
    hasJSX: boolean;
  };
  hints: {
    route?: string;
    kind?: "route" | "layout" | "component" | "util" | "config";
  };
  // 🔽 add these so we actually use your new helpers
  metrics?: { sloc: number; bytes: number };
  todos?: { line: number; text: string }[];
  media?: { mux: boolean; hls: boolean; video: boolean };
  git?: { lastCommitUnix?: number; author?: string; abbrevSha?: string };
};

type Report = {
  root: string;
  generatedAt: string; // ISO
  ignore: string[];
  files: FileReport[];
};

type Cli = {
  root: string;
  out?: string;
  md?: boolean;
  include?: string[];  // CSV globs
  exclude?: string[];  // CSV globs
  workspaces?: boolean;
  since?: string;      // e.g. "origin/main" or "2025-09-01"
  todos?: number;      // max TODOs per file
  graph?: boolean;
};

const argv = new Map<string, string | boolean>();
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.startsWith("--")) {
    const [k, v] = a.split("=");
    if (v === undefined) {
      argv.set(k, true);
    } else {
      argv.set(k, v);
    }
  }
}
const ROOT = path.resolve(String(argv.get("--root") || "."));
const OUT_BASENAME = String(argv.get("--out") || "");
const WANT_MD = Boolean(argv.get("--md") || false);

function parseCSV(v?: string | boolean): string[] | undefined {
  if (!v || typeof v === "boolean") return undefined;
  return v.split(",").map(s => s.trim()).filter(Boolean);
}
const cli: Cli = {
  root: path.resolve(String(argv.get("--root") || ".")),
  out: argv.get("--out") ? String(argv.get("--out")) : undefined,
  md: Boolean(argv.get("--md") || false),
  include: parseCSV(argv.get("--include")),
  exclude: parseCSV(argv.get("--exclude")),
  workspaces: Boolean(argv.get("--workspaces") || false),
  since: argv.get("--since") ? String(argv.get("--since")) : undefined,
  todos: argv.get("--todos") ? Number(argv.get("--todos")) : undefined,
  graph: Boolean(argv.get("--graph") || false),
};

function loadIgnore(root: string) {
  const ig = ignore();
  const p = path.join(root, ".gitignore");
  if (fs.existsSync(p)) ig.add(fs.readFileSync(p, "utf8"));
  return ig;
}
const ig = loadIgnore(ROOT);

function allows(rel: string): boolean {
  if (ig.ignores(rel)) return false;
  if (cli.include && !cli.include.some(g => minimatch(rel, g))) return false;
  if (cli.exclude &&  cli.exclude.some(g => minimatch(rel, g))) return false;
  return true;
}

function gitMeta(rel: string) {
  try {
    const base = `git -C ${JSON.stringify(cli.root)}`;
    const sha = execSync(`${base} log -1 --pretty=%h -- ${JSON.stringify(rel)}`).toString().trim();
    const ts  = execSync(`${base} log -1 --date=unix --pretty=%cd -- ${JSON.stringify(rel)}`).toString().trim();
    const au  = execSync(`${base} log -1 --pretty=%an -- ${JSON.stringify(rel)}`).toString().trim();
    return { lastCommitUnix: Number(ts) || undefined, author: au || undefined, abbrevSha: sha || undefined };
  } catch { return {}; }
}

function changedSince(rel: string): boolean {
  if (!cli.since) return true;
  try {
    const base = `git -C ${JSON.stringify(cli.root)}`;
    execSync(`${base} diff --name-only ${cli.since} -- ${JSON.stringify(rel)}`, { stdio: "pipe" });
    const out = execSync(`${base} diff --name-only ${cli.since} -- ${JSON.stringify(rel)}`).toString().trim();
    return !!out;
  } catch { return true; }
}

function sloc(text: string) {
  return text.split(/\r?\n/).filter(l => l.trim() !== "").length;
}
function findTodos(text: string, max = 10) {
  const lines = text.split(/\r?\n/);
  const hits: { line: number; text: string }[] = [];
  for (let i = 0; i < lines.length && hits.length < max; i++) {
    if (/\b(TODO|FIXME|HACK)\b/.test(lines[i])) hits.push({ line: i+1, text: lines[i].trim().slice(0, 240) });
  }
  return hits;
}

function detectMux(text: string) {
  const mux = /mux|createMuxClient|PlaybackID|m3u8/i.test(text);
  const hls = /from ['"]hls\.js['"]|\.m3u8\b|Hls\./i.test(text);
  const video = /<video[^>]+/i.test(text);
  return { mux, hls, video };
}

type Graph = Record<string, string[]>;
const graph: Graph = {};



const IGNORE_DIRS = new Set([
  "node_modules","dist","build",".next",".nuxt",".svelte-kit",".expo",
  ".turbo",".vercel",".output",".cache","coverage",".git",".idea",".vscode",
  "android","ios"
]);
const INCLUDE_EXT = new Set([".ts",".tsx",".js",".jsx",".mjs",".cjs"]);

function walk(dir: string): string[] {
  const ents = fs.readdirSync(dir, { withFileTypes: true });
  const out: string[] = [];
  for (const e of ents) {
    if (e.name.startsWith(".")) {
      if (e.isDirectory() && ![".env","env"].includes(e.name)) continue;
    }
    const full = path.join(dir, e.name);
    const rel = path.relative(ROOT, full);
    if (e.isDirectory()) {
      const base = path.basename(full);
      if (IGNORE_DIRS.has(base)) continue;
      out.push(...walk(full));
    } else if (e.isFile()) {
      if (INCLUDE_EXT.has(path.extname(e.name)) && allows(rel)) {
        out.push(rel);
      }
    }
  }
  return out.sort();
}

function readFileAbs(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function extractLeadingBlockSummary(sourceText: string): string | undefined {
  // Grab first /** ... */ before any import/export
  const m = sourceText.match(/^\s*\/\*\*([\s\S]*?)\*\/\s*(?:import|export|const|function|class)/m);
  if (!m) return undefined;
  const raw = m[1]
    .replace(/\r/g, "")
    .split("\n")
    .map(l => l.replace(/^\s*\* ?/, ""))
    .join("\n")
    .trim();
  return raw || undefined;
}

function isPascalCase(name: string) {
  return /^[A-Z][A-Za-z0-9]*$/.test(name);
}

function makeSource(rel: string, text: string) {
  const ext = path.extname(rel).toLowerCase();
  const lang = ext === ".tsx" || ext === ".jsx"
    ? ts.ScriptKind.TSX
    : ext === ".ts" ? ts.ScriptKind.TS
    : ts.ScriptKind.JS;
  return ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, lang);
}

function analyzeFile(rel: string): FileReport {
  const text = readFileAbs(rel);
  const sf = makeSource(rel, text);

    

  const rep: FileReport = {
    file: rel.split(path.sep).join("/"),
    summary: extractLeadingBlockSummary(text),
    exports: { functions: [], consts: [], classes: [], types: [], interfaces: [], enums: [] },
    react: { components: [], hasJSX: false },
    hints: {}
  };

  // JSX heuristic
  function scanJSX(n: ts.Node) {
    if (n.kind === ts.SyntaxKind.JsxElement
      || n.kind === ts.SyntaxKind.JsxSelfClosingElement
      || n.kind === ts.SyntaxKind.JsxFragment) {
      rep.react.hasJSX = true;
      const stat = fs.statSync(path.join(ROOT, rel));
    rep.metrics = { sloc: sloc(text), bytes: stat.size };
    rep.media = detectMux(text);
    rep.git = gitMeta(rel);
    if (cli.todos && cli.todos > 0) rep.todos = findTodos(text, cli.todos);
    }
    n.forEachChild(scanJSX);
  }
  scanJSX(sf);

  // Exported symbols
  sf.forEachChild(node => {
    // default export
    if (ts.canHaveModifiers(node) && ts.getModifiers(node)?.some(m => m.kind === ts.SyntaxKind.DefaultKeyword)) {
      rep.exports.defaultExport = "default";
    }
    const isExported = ts.getCombinedModifierFlags(node as ts.Declaration) & ts.ModifierFlags.Export;

    if (ts.isFunctionDeclaration(node)) {
      const name = node.name?.getText(sf) || "(anonymous)";
      if (isExported) rep.exports.functions.push(name);
      if (isPascalCase(name)) rep.react.components.push(name);
      return;
    }
    if (ts.isVariableStatement(node)) {
      const isVarExported = ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Export;
      if (isVarExported) {
        for (const d of node.declarationList.declarations) {
          const nm = d.name.getText(sf);
          rep.exports.consts.push(nm);
          if (isPascalCase(nm)) rep.react.components.push(nm); // heuristic
        }
      }
      return;
    }
    if (ts.isClassDeclaration(node)) {
      const name = node.name?.getText(sf) || "(anonymous)";
      if (isExported) rep.exports.classes.push(name);
      if (isPascalCase(name)) rep.react.components.push(name);
      return;
    }
    if (ts.isInterfaceDeclaration(node)) {
      const name = node.name.getText(sf);
      const isExp = ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Export;
      if (isExp) rep.exports.interfaces.push(name);
      return;
    }
    if (ts.isTypeAliasDeclaration(node)) {
      const name = node.name.getText(sf);
      const isExp = ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Export;
      if (isExp) rep.exports.types.push(name);
      return;
    }
    if (ts.isEnumDeclaration(node)) {
      const name = node.name.getText(sf);
      const isExp = ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Export;
      if (isExp) rep.exports.enums.push(name);
      return;
    }
    if (ts.isExportAssignment(node)) {
      rep.exports.defaultExport = node.expression.getText(sf) || "default";
      return;
    }
  });

  // Hints: route/layout/component/util/config
  const p = rep.file;
  const base = path.basename(p);
  const dir = p.split("/").slice(0, -1).join("/");
  if (/\/(app|pages|src\/routes)\//.test(p)) {
    rep.hints.kind = "route";
    // Next.js style: app/(group)/feed/page.tsx -> /feed
    if (base.match(/^page\.(t|j)sx?$/)) {
      const segs = dir.split("/").filter(s => s && !s.startsWith("(") && s !== "app" && s !== "pages" && s !== "src" && s !== "routes");
      rep.hints.route = "/" + segs.join("/");
    } else if (base.match(/^layout\.(t|j)sx?$/)) {
      rep.hints.kind = "layout";
      const segs = dir.split("/").filter(s => s && !s.startsWith("(") && s !== "app");
      rep.hints.route = "/" + segs.join("/");
    }
  } else if (/\/components?\//.test(p)) {
    rep.hints.kind = "component";
  } else if (/\/(lib|utils?|services?|hooks|helpers)\//.test(p)) {
    rep.hints.kind = "util";
  } else if (/(^|\/)(config|vite|next|remix|webpack|tailwind)\.config\./.test(p)) {
    rep.hints.kind = "config";
  }

  return rep;
}

function toMarkdown(report: Report): string {
  const lines: string[] = [];
  lines.push(`# Project Tree (${report.root})`);
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push("");
  // Tree
  const byDir = new Map<string, string[]>();
  for (const f of report.files) {
    const d = path.dirname(f.file);
    const arr = byDir.get(d) || [];
    arr.push(f.file);
    byDir.set(d, arr);
  }
  // Simple bullet tree
  const parts = report.files.map(f => `- \`${f.file}\`${f.hints.kind ? ` — *${f.hints.kind}${f.hints.route ? ` ${f.hints.route}`:""}*`:""}`);
  lines.push("## Files");
  lines.push(...parts);
  lines.push("");
  lines.push("## Details");
  for (const f of report.files) {
    lines.push(`### \`${f.file}\``);
    if (f.summary) lines.push(f.summary, "");
    if (f.hints.kind) lines.push(`- **Kind:** ${f.hints.kind}${f.hints.route ? ` — Route: \`${f.hints.route}\`` : ""}`);
    lines.push(`- **Has JSX:** ${f.react.hasJSX ? "yes" : "no"}`);
    if (f.react.components.length) lines.push(`- **Components:** ${f.react.components.join(", ")}`);

    if (f.metrics) lines.push(`- **Size:** ${f.metrics.bytes} bytes — **SLOC:** ${f.metrics.sloc}`);
    if (f.git && (f.git.abbrevSha || f.git.lastCommitUnix)) {
      const dt = f.git.lastCommitUnix ? new Date(f.git.lastCommitUnix * 1000).toISOString() : "";
      lines.push(`- **Git:** ${f.git.abbrevSha || ""} ${dt ? `@ ${dt}` : ""}${f.git.author ? ` — ${f.git.author}` : ""}`);
    }
    if (f.media && (f.media.mux || f.media.hls || f.media.video)) {
      const tags = [
        f.media.mux && "mux",
        f.media.hls && "hls",
        f.media.video && "video"
      ].filter(Boolean).join(", ");
      lines.push(`- **Media:** ${tags}`);
    }
    if (f.todos?.length) {
      lines.push(`- **TODOs (${f.todos.length}):**`);
      for (const t of f.todos) lines.push(`  - L${t.line}: ${t.text}`);
    }


    const ex = f.exports;
    const exLines = [];
    if (ex.defaultExport) exLines.push(`default: ${ex.defaultExport}`);
    if (ex.functions.length) exLines.push(`functions: ${ex.functions.join(", ")}`);
    if (ex.consts.length) exLines.push(`consts: ${ex.consts.join(", ")}`);
    if (ex.classes.length) exLines.push(`classes: ${ex.classes.join(", ")}`);
    if (ex.types.length) exLines.push(`types: ${ex.types.join(", ")}`);
    if (ex.interfaces.length) exLines.push(`interfaces: ${ex.interfaces.join(", ")}`);
    if (ex.enums.length) exLines.push(`enums: ${ex.enums.join(", ")}`);
    lines.push(`- **Exports:** ${exLines.length ? exLines.join(" | ") : "—"}`);
    lines.push("");
  }
  return lines.join("\n");
}

function main() {
  const files = walk(ROOT);
  const filtered = cli.since ? files.filter(f => changedSince(f)) : files;
  const report: Report = {
    root: path.basename(ROOT),
    generatedAt: new Date().toISOString(),
    ignore: Array.from(IGNORE_DIRS),
    files: files.map(analyzeFile),
  };

  // Outputs
  if (OUT_BASENAME) {
    const outDir = path.isAbsolute(OUT_BASENAME)
      ? OUT_BASENAME
      : path.join(ROOT, OUT_BASENAME);
    fs.mkdirSync(outDir, { recursive: true });
    const jsonPath = path.join(outDir, "project-tree.json");
    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), "utf8");
    const mdPath = path.join(outDir, "project-tree.md");
    fs.writeFileSync(mdPath, toMarkdown(report), "utf8");
    console.log(`Wrote:\n- ${jsonPath}\n- ${mdPath}`);
  } else if (WANT_MD) {
    console.log(toMarkdown(report));
  } else {
    console.log(JSON.stringify(report, null, 2));
  }
}

main();

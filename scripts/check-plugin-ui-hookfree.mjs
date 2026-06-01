#!/usr/bin/env node
// Guard: plugin UI components must be hook-free OOP classes.
// Fails when any plugins/<slug>/src/ui/**/*.tsx file contains a React hook call
// or an `export const/function <Capitalized>` (function component).
//
// Run from framework/Source:  node scripts/check-plugin-ui-hookfree.mjs
// Resolves the repo-root plugins dir the same way check-sdk-boundary.mjs does.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const PLUGINS_DIR = path.resolve(process.cwd(), '../../plugins');

// Dev/test fixtures excluded until Task 20 decides their fate.
const IGNORE = new Set(['build-server', 'test-feature']);

const HOOK = /\buse(State|Effect|Memo|Ref|Callback|Context)\b/;
const FC = /export\s+(const|function)\s+[A-Z][A-Za-z0-9]*/;

function walkTsx(dir, out) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    const full = path.join(dir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) walkTsx(full, out);
    else if (full.endsWith('.tsx')) out.push(full);
  }
}

const violations = [];
let scanned = 0;

let slugs = [];
try {
  slugs = readdirSync(PLUGINS_DIR);
} catch {
  console.error(`Cannot read plugins dir: ${PLUGINS_DIR}`);
  process.exit(2);
}

for (const slug of slugs) {
  if (IGNORE.has(slug)) continue;
  const uiDir = path.join(PLUGINS_DIR, slug, 'src', 'ui');
  const files = [];
  walkTsx(uiDir, files);
  for (const file of files) {
    scanned += 1;
    const src = readFileSync(file, 'utf8');
    const rel = path.relative(PLUGINS_DIR, file);
    if (HOOK.test(src)) violations.push(`plugins/${rel}: contains a React hook call`);
    if (FC.test(src)) violations.push(`plugins/${rel}: contains 'export const/function <Capitalized>' (function component)`);
  }
}

if (violations.length) {
  console.error(`Plugin UI hook-free check FAILED (${violations.length} violations across ${scanned} files):\n`);
  console.error(violations.join('\n'));
  process.exit(1);
}

console.log(`Plugin UI hook-free check passed (${scanned} files).`);

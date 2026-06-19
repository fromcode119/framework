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

// No files currently require a hook-boundary exemption.
// order-popup-connected.tsx was converted to a hook-free PluginComponent class (Task 3 complete).
const IGNORE_FILES = new Set();

// Pre-existing offenders found when the checker's blind spots were closed
// (.ts scanning + custom-hook detection). Each is REPORTED as a warning on every
// run — burn this list down to zero, do not add to it.
const KNOWN_OFFENDERS = new Set([
  'cms/src/ui/components/block-editor/block-editor-settings-panel.tsx',
  'cms/src/ui/components/visual-editor/cms-document-context.ts',
  'cms/src/ui/components/visual-editor/visual-editor-runtime-context.ts',
  'cms/src/ui/hooks/use-datasource-selector.ts',
  'cms/src/ui/hooks.ts',
  'ecommerce/src/ui/checkout-flow/controller/checkout-flow-controller.ts',
  'ecommerce/src/ui/ecommerce-plugin-client.ts',
  'numerology/src/ui/use-async-data.ts',
]);

const HOOK = /\buse(State|Effect|Memo|Ref|Callback|Context)\b/;
// Custom hook invocation: bare `useXxx(` not preceded by `.` (method calls on a
// namespace/class are not React hooks) or a word character.
const CUSTOM_HOOK = /(?<![.\w])use[A-Z]\w*\s*\(/;
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
    else if (full.endsWith('.tsx') || (full.endsWith('.ts') && !full.endsWith('.d.ts'))) out.push(full);
  }
}

const violations = [];
const knownOffenderWarnings = [];
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
    const rel = path.relative(PLUGINS_DIR, file);
    if (IGNORE_FILES.has(rel)) continue;
    scanned += 1;
    const src = readFileSync(file, 'utf8');
    const fileViolations = [];
    if (HOOK.test(src)) fileViolations.push(`plugins/${rel}: contains a React hook call`);
    else if (CUSTOM_HOOK.test(src)) fileViolations.push(`plugins/${rel}: contains a custom hook invocation (use<X>())`);
    if (FC.test(src) && file.endsWith('.tsx')) fileViolations.push(`plugins/${rel}: contains 'export const/function <Capitalized>' (function component)`);
    if (!fileViolations.length) continue;
    if (KNOWN_OFFENDERS.has(rel)) {
      knownOffenderWarnings.push(...fileViolations.map((v) => `${v} [known offender — burn down]`));
    } else {
      violations.push(...fileViolations);
    }
  }
}

if (knownOffenderWarnings.length) {
  console.warn(`Plugin UI hook-free check: ${knownOffenderWarnings.length} known-offender warnings (allowlisted, fix eventually):`);
  console.warn(knownOffenderWarnings.join('\n'));
}

if (violations.length) {
  console.error(`Plugin UI hook-free check FAILED (${violations.length} violations across ${scanned} files):\n`);
  console.error(violations.join('\n'));
  process.exit(1);
}

console.log(`Plugin UI hook-free check passed (${scanned} files, ${knownOffenderWarnings.length} allowlisted warnings).`);

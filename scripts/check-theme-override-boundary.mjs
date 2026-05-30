#!/usr/bin/env node
/**
 * Theme override boundary check.
 *
 * Enforces the "Theme / Plugin Ownership & Layout/Override Model" rule (AGENTS.md):
 * files under `themes/<slug>/src/overrides/**` must be PRESENTATION ONLY. Domain
 * behaviour belongs in the owning plugin and is consumed through a plugin-provided
 * headless controller — never re-implemented in the theme.
 *
 * Flags, under any theme `src/overrides/` tree:
 *   - `lib/`, `_services/`, `_hooks/` directories
 *   - `*-service.ts(x)` files (domain services)
 *   - `*.test.ts(x)` files (domain behaviour tests)
 *   - imports of plugin source (relative `…/plugins/<slug>/…` or `@fromcode119/<plugin>`)
 *
 * Mode (env THEME_OVERRIDE_BOUNDARY_MODE):
 *   - "warn" (default): report findings, exit 0.
 *   - "error": report findings, exit 1 if any are found.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const THEMES_DIR = path.resolve(ROOT, '../../themes');
const MODE = (process.env.THEME_OVERRIDE_BOUNDARY_MODE || 'warn').toLowerCase();

const SOURCE_FILE_PATTERN = /\.(ts|tsx)$/;
const IGNORE_PATH_PATTERNS = [/\/node_modules\//, /\/dist\//, /\/\.next\//];
const PLUGIN_SOURCE_IMPORT = /from\s+['"](?:[^'"]*\/plugins\/[^'"]+|@fromcode119\/(?!sdk(?:\/|['"]|$))[^'"]+)['"]/;

function walk(dir, files = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return files;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (IGNORE_PATH_PATTERNS.some((re) => re.test(full))) continue;
    if (entry.isDirectory()) {
      walk(full, files);
    } else {
      files.push(full);
    }
  }
  return files;
}

function findOverrideRoots() {
  const roots = [];
  let themes;
  try {
    themes = fs.readdirSync(THEMES_DIR, { withFileTypes: true });
  } catch {
    return roots;
  }
  for (const theme of themes) {
    if (!theme.isDirectory()) continue;
    const overrides = path.join(THEMES_DIR, theme.name, 'src', 'overrides');
    if (fs.existsSync(overrides)) roots.push(overrides);
  }
  return roots;
}

const findings = [];
function record(file, reason) {
  findings.push({ file: path.relative(THEMES_DIR, file), reason });
}

for (const overridesRoot of findOverrideRoots()) {
  for (const file of walk(overridesRoot)) {
    const rel = file;
    if (/\/(lib|_services|_hooks)\//.test(rel)) {
      record(file, 'forbidden directory under overrides (lib/_services/_hooks)');
      continue;
    }
    if (!SOURCE_FILE_PATTERN.test(rel)) continue;
    if (/\.test\.(ts|tsx)$/.test(rel)) {
      record(file, 'domain test under overrides (*.test.*)');
      continue;
    }
    if (/-service\.(ts|tsx)$/.test(rel)) {
      record(file, 'domain service file under overrides (*-service.*)');
    }
    let content = '';
    try {
      content = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    if (PLUGIN_SOURCE_IMPORT.test(content)) {
      record(file, 'imports plugin source (must consume the plugin via @fromcode119/sdk / namespace)');
    }
  }
}

const header = '[check-theme-override-boundary]';
if (findings.length === 0) {
  console.log(`${header} OK — theme overrides are presentation-only.`);
  process.exit(0);
}

console.log(`${header} ${findings.length} finding(s) (mode=${MODE}):`);
for (const f of findings) {
  console.log(`  - ${f.file}\n      ${f.reason}`);
}

if (MODE === 'error') {
  console.error(`${header} FAILED in error mode.`);
  process.exit(1);
}
console.log(`${header} warn mode — not failing the build. Set THEME_OVERRIDE_BOUNDARY_MODE=error to enforce.`);
process.exit(0);

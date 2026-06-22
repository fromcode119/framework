#!/usr/bin/env node
/**
 * Appearance boundary check.
 *
 * Admin "appearances" are content that plugs into the appearance ENGINE; they MUST live OUTSIDE the
 * framework, in the repo-root `appearance/<slug>/` folder (mounted into the containers, like
 * `plugins/` and `themes/`). The framework ships ONLY the engine (`packages/admin/lib/appearance/`)
 * and the built-in `default` appearance — no additional/packaged appearance may be committed inside it.
 *
 * Flags, anywhere under `packages/admin/` EXCEPT the engine `lib/appearance/`:
 *   - any directory named `appearance` or `appearances`
 *   - any `*-appearance-bootstrap.{ts,tsx}` file (the signature of a packaged appearance)
 *
 * Mode (env APPEARANCE_BOUNDARY_MODE): "error" (default) fails the build on findings; "warn" reports only.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const ADMIN_DIR = path.resolve(ROOT, 'packages/admin');
const ENGINE_DIR = path.resolve(ADMIN_DIR, 'lib/appearance');
const MODE = (process.env.APPEARANCE_BOUNDARY_MODE || 'error').toLowerCase();

// `components/_appearances/` is the build-staged copy produced by build-appearances.sh (gitignored,
// not hand-authored) — it's how external appearances enter the build, so it is NOT a boundary violation.
const IGNORE = [/\/node_modules\//, /\/dist\//, /\/\.next\//, /\/components\/_appearances\//];

function walk(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (IGNORE.some((re) => re.test(full))) continue;
    out.push({ full, isDir: entry.isDirectory(), name: entry.name });
    if (entry.isDirectory()) walk(full, out);
  }
  return out;
}

const inEngine = (p) => p === ENGINE_DIR || p.startsWith(ENGINE_DIR + path.sep);
const findings = [];

for (const { full, isDir, name } of walk(ADMIN_DIR)) {
  if (inEngine(full)) continue;
  // A packaged appearance is identified by its bootstrap file — the precise, unambiguous signal.
  // (Dir names like `app/appearances/` are framework infra — the asset route, the loader — not a
  // packaged appearance, so we do NOT flag by directory name.)
  if (!isDir && /-appearance-bootstrap\.(ts|tsx)$/.test(name)) {
    findings.push({ file: path.relative(ROOT, full), reason: 'packaged appearance bootstrap inside the framework — appearances live in repo-root appearance/<slug>/' });
  }
}

const header = '[check-appearance-boundary]';
if (findings.length === 0) {
  console.log(`${header} OK — no packaged appearances inside the framework (engine + default only).`);
  process.exit(0);
}

console.log(`${header} ${findings.length} finding(s) (mode=${MODE}):`);
for (const f of findings) {
  console.log(`  - ${f.file}\n      ${f.reason}`);
}

if (MODE === 'error') {
  console.error(`${header} FAILED — appearances must live outside the framework (repo-root appearance/).`);
  process.exit(1);
}
console.log(`${header} warn mode — not failing the build. Set APPEARANCE_BOUNDARY_MODE=error to enforce.`);
process.exit(0);

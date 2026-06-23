#!/usr/bin/env node
/**
 * Propagate the ROOT @fromcode119/framework version into every workspace package.
 *
 * The framework versions as a single unit: you bump the root `package.json` once, and this stamps that
 * version into all `packages/*` — no per-package edits. Wired as the first step of the root `build` so
 * the packages can never drift behind the root again (which made the engine report a stale version and
 * the updater offer an older registry release as an "upgrade"). Cross-package deps use `*`, so only the
 * `version` field needs syncing.
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const rootPkgPath = join(root, 'package.json');
const rootPkg = JSON.parse(readFileSync(rootPkgPath, 'utf8'));
const version = String(rootPkg.version || '').trim();

if (rootPkg.name !== '@fromcode119/framework' || !version) {
  console.error('[sync-versions] root @fromcode119/framework version not found — aborting.');
  process.exit(1);
}

const packagesDir = join(root, 'packages');
let changed = 0;
for (const name of readdirSync(packagesDir)) {
  const pkgPath = join(packagesDir, name, 'package.json');
  if (!existsSync(pkgPath)) continue;

  const raw = readFileSync(pkgPath, 'utf8');
  const pkg = JSON.parse(raw);
  if (!String(pkg.name || '').startsWith('@fromcode119/')) continue;
  if (pkg.version === version) continue;

  const previous = pkg.version;
  pkg.version = version;
  // Preserve the file's trailing newline if it had one.
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + (raw.endsWith('\n') ? '\n' : ''));
  console.log(`[sync-versions] ${pkg.name}: ${previous} -> ${version}`);
  changed += 1;
}

console.log(`[sync-versions] root @fromcode119/framework@${version}; ${changed} package(s) updated.`);

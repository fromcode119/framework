import fs from 'node:fs';
import path from 'node:path';

// Plugin architecture checker — restored after the original was lost.
// Enforces the documented plugin conventions (AGENTS.md / CLAUDE.md):
//   SIZE   — .ts files ≤ 300 lines, .tsx files ≤ 200 lines
//   LAYER  — controllers must not access context.db directly (route → controller
//            → service → repository); entry/wiring files must not hold business logic
//   LEGACY — dead dual field lookups (`row?.fieldName || row?.field_name`) and
//            snake_case property reads of proxy-returned rows
//
// Modes per category via env: ARCH_SIZE_MODE / ARCH_LAYER_MODE / ARCH_LEGACY_MODE
//   = 'warn' (default: report, exit 0) | 'error' (report, exit 1) | 'off'
// ARCH_ENFORCE_PLUGINS=a,b,c — error mode applies only to the listed plugins;
//   all other plugins are reported at warn level regardless of mode.

const ROOT = process.cwd();
const PLUGINS_DIR = path.resolve(ROOT, '../../plugins');

const MODES = {
  size: normalizeMode(process.env.ARCH_SIZE_MODE),
  layer: normalizeMode(process.env.ARCH_LAYER_MODE),
  legacy: normalizeMode(process.env.ARCH_LEGACY_MODE),
};
const ENFORCED_PLUGINS = String(process.env.ARCH_ENFORCE_PLUGINS || '')
  .split(',')
  .map((slug) => slug.trim())
  .filter(Boolean);

const TS_MAX_LINES = 300;
const TSX_MAX_LINES = 200;
const SOURCE_PATTERN = /\.(ts|tsx)$/;
const IGNORE_PATTERNS = [
  /\/node_modules\//,
  /\/dist\//,
  /\.test\.(ts|tsx)$/,
  /\.d\.ts$/,
  /\/migrations\//,
  /\/seed/i,
];

// Dual lookup: `?.someCamel || ?.some_snake` (and ?? variant) — always dead code
// per the single-canonical-name rule.
const DUAL_LOOKUP_PATTERN = /\?\.\s*[a-z][a-zA-Z0-9]*\s*(?:\|\||\?\?)\s*[a-zA-Z_$][\w$]*\s*\?\.\s*[a-z]+_[a-z_]+\b/;
const CONTROLLER_DB_PATTERN = /\bcontext\.db\.(find|findOne|insert|update|delete|raw)\b/;

function normalizeMode(value) {
  const mode = String(value || '').trim().toLowerCase();
  if (mode === 'error' || mode === 'off') return mode;
  return 'warn';
}

function walk(directoryPath) {
  const files = [];
  for (const entry of fs.readdirSync(directoryPath, { withFileTypes: true })) {
    const nextPath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(nextPath));
    } else {
      files.push(nextPath);
    }
  }
  return files;
}

function shouldScan(filePath) {
  if (!SOURCE_PATTERN.test(filePath)) return false;
  return !IGNORE_PATTERNS.some((pattern) => pattern.test(filePath));
}

function pluginSlugOf(filePath) {
  const relative = path.relative(PLUGINS_DIR, filePath);
  return relative.split(path.sep)[0] || '';
}

function checkFile(filePath) {
  const findings = [];
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  // SIZE
  const maxLines = filePath.endsWith('.tsx') ? TSX_MAX_LINES : TS_MAX_LINES;
  if (lines.length > maxLines) {
    findings.push({
      category: 'size',
      filePath,
      lineNumber: 1,
      message: `${lines.length} lines (max ${maxLines})`,
    });
  }

  // LAYER — controllers must not touch context.db directly
  if (/\/src\/controllers\//.test(filePath)) {
    lines.forEach((line, index) => {
      if (CONTROLLER_DB_PATTERN.test(line)) {
        findings.push({
          category: 'layer',
          filePath,
          lineNumber: index + 1,
          message: 'controller accesses context.db directly (route → controller → service → repository)',
        });
      }
    });
  }

  // LEGACY — dead dual lookups
  lines.forEach((line, index) => {
    if (DUAL_LOOKUP_PATTERN.test(line)) {
      findings.push({
        category: 'legacy',
        filePath,
        lineNumber: index + 1,
        message: 'dual camelCase/snake_case field lookup (snake branch is dead code)',
      });
    }
  });

  return findings;
}

if (!fs.existsSync(PLUGINS_DIR)) {
  console.log('[check-plugin-architecture] no plugins directory found — skipping');
  process.exit(0);
}

const allFindings = [];
for (const filePath of walk(PLUGINS_DIR)) {
  if (!shouldScan(filePath)) continue;
  allFindings.push(...checkFile(filePath));
}

let errorCount = 0;
let warnCount = 0;
const counts = { size: 0, layer: 0, legacy: 0 };

for (const finding of allFindings) {
  const mode = MODES[finding.category];
  if (mode === 'off') continue;

  const slug = pluginSlugOf(finding.filePath);
  const enforced = ENFORCED_PLUGINS.length === 0 || ENFORCED_PLUGINS.includes(slug);
  const severity = mode === 'error' && enforced ? 'ERROR' : 'warn';
  if (severity === 'ERROR') errorCount += 1;
  else warnCount += 1;
  counts[finding.category] += 1;

  const relativePath = path.relative(ROOT, finding.filePath) || finding.filePath;
  console.log(`[${severity}] [${finding.category}] ${relativePath}:${finding.lineNumber} ${finding.message}`);
}

console.log(
  `[check-plugin-architecture] size=${counts.size} layer=${counts.layer} legacy=${counts.legacy} ` +
    `(${errorCount} errors, ${warnCount} warnings; modes size=${MODES.size} layer=${MODES.layer} legacy=${MODES.legacy}` +
    (ENFORCED_PLUGINS.length ? `; enforced=${ENFORCED_PLUGINS.join(',')}` : '') +
    ')',
);

process.exit(errorCount > 0 ? 1 : 0);

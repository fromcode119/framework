import fs from 'node:fs';
import path from 'node:path';

/*
 * check-db-find-where
 * -------------------
 * The database manager's `find(table, options)` and `count(table, options)` filter
 * ONLY by `options.where`. A filter field passed at the TOP LEVEL of the options
 * object — e.g. `db.find(T, { status, limit })` or `db.count(T, { status })` — is
 * SILENTLY IGNORED, returning EVERY row up to `limit` (or counting all rows). This
 * has caused money double-payouts, PII leaks across tenants, and GDPR-erase touching
 * every record. (Confirmed in packages/database/src/dialects/sqlite-database-manager.ts:
 * both `find` and `count` destructure only `{ where, ... }`.)
 *
 * `findOne(table, where)` takes the where directly, so it is NOT affected.
 *
 * This guard flags the two deterministic, false-positive-free signatures of the bug:
 *   1. INLINE-BAD: `.db.find(`/`.db.count(` whose inline options object has a
 *      top-level key outside the allowed set and no `where`.
 *   2. COUNT-RAW-FILTER: `.db.count(` passed a bare identifier as the 2nd arg
 *      (a raw filter object — count needs it nested under `{ where }`).
 *
 * Fix: move filter fields under `where: { ... }`, keeping limit/offset/orderBy as
 * siblings. Intentionally-unfiltered admin reads (`{ limit }` / `{ columns, limit }`)
 * are allowed. `restController.find({ query, user, ... })` is a different method and
 * is excluded (this guard only matches the `.db.` receiver).
 */

const ROOT = process.cwd();
const TARGET_DIRS = [
  path.resolve(ROOT, '../../plugins'),
  path.resolve(ROOT, 'packages'),
];

const SOURCE_FILE_PATTERN = /\.(ts|tsx|js|jsx|mjs|cjs)$/;
const IGNORE_PATH_PATTERNS = [
  /\/node_modules\//,
  /\/dist\//,
  /\/bundle\.js$/,
  /\/index\.js$/,
  /\/frontend\.js$/,
  /\.d\.ts$/,
  // Tests contain illustrative/doc snippets of the buggy shape on purpose.
  /\.test\.(ts|tsx|js|jsx|mjs|cjs)$/,
  /\.spec\.(ts|tsx|js|jsx|mjs|cjs)$/,
  /\/__tests__\//,
  /\/tests?\//,
];

// Real options honored by the database manager. Anything else at the top level of
// the options object is silently dropped — i.e. a filter that does not filter.
const ALLOWED_KEYS = new Set([
  'where', 'limit', 'offset', 'orderBy', 'columns', 'joins', 'search',
]);

// Receivers that ARE the database manager (excludes restController.find, store.find, etc.).
const CALL_PATTERN = /\.db\s*\.\s*(find|count)\s*\(/g;

function walk(directoryPath) {
  const files = [];
  for (const entry of fs.readdirSync(directoryPath, { withFileTypes: true })) {
    const nextPath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(nextPath));
      continue;
    }
    files.push(nextPath);
  }
  return files;
}

function shouldScan(filePath) {
  if (!SOURCE_FILE_PATTERN.test(filePath)) return false;
  return !IGNORE_PATH_PATTERNS.some((pattern) => pattern.test(filePath));
}

// Remove block and line comments so doc snippets of the buggy shape don't trip the
// scanner. Good enough for locating `.db.find(`/`.db.count(` call sites.
function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/g, (full, lead) => lead + ''.padEnd(full.length - lead.length, ' '));
}

// Returns { kind: 'object'|'identifier'|'other'|'none', raw } for the 2nd argument
// of a call whose `(` follows index `openParen`.
function secondArgument(text, openParen) {
  let i = openParen + 1;
  const n = text.length;
  let depth = 0;
  let inString = null;
  let commaIndex = null;

  while (i < n) {
    const c = text[i];
    if (inString) {
      if (c === inString && text[i - 1] !== '\\') inString = null;
    } else if (c === '"' || c === '\'' || c === '`') {
      inString = c;
    } else if (c === '(' || c === '[' || c === '{') {
      depth += 1;
    } else if (c === ')' || c === ']' || c === '}') {
      if (depth === 0) return { kind: 'none', raw: '' }; // single-arg call
      depth -= 1;
    } else if (c === ',' && depth === 0) {
      commaIndex = i;
      break;
    }
    i += 1;
  }
  if (commaIndex === null) return { kind: 'none', raw: '' };

  let j = commaIndex + 1;
  while (j < n && /\s/.test(text[j])) j += 1;
  if (j >= n) return { kind: 'none', raw: '' };

  if (text[j] === '{') {
    depth = 0;
    inString = null;
    for (let k = j; k < n; k += 1) {
      const c = text[k];
      if (inString) {
        if (c === inString && text[k - 1] !== '\\') inString = null;
      } else if (c === '"' || c === '\'' || c === '`') {
        inString = c;
      } else if (c === '{') {
        depth += 1;
      } else if (c === '}') {
        depth -= 1;
        if (depth === 0) return { kind: 'object', raw: text.slice(j, k + 1) };
      }
    }
    return { kind: 'none', raw: '' };
  }

  // A bare identifier as the 2nd arg: only `where` (already correct) and plain
  // identifiers immediately followed by `)` count — a ternary/object/member access
  // (`x ? {where} : undefined`, `x.opts`, `{ ...x }`) is not a raw-filter pass.
  const rest = text.slice(j, j + 80);
  const bare = rest.match(/^([A-Za-z_$][\w$]*)\s*\)/);
  if (bare) return { kind: 'identifier', raw: bare[1] };
  return { kind: 'other', raw: rest.slice(0, 40) };
}

// Top-level keys of an object literal `{ ... }` (handles nesting, strings, spreads).
function topLevelKeys(objectLiteral) {
  const inner = objectLiteral.slice(1, -1);
  const keys = [];
  let depth = 0;
  let inString = null;
  let token = '';
  let hasSpread = false;

  for (let i = 0; i < inner.length; i += 1) {
    const c = inner[i];
    if (inString) {
      if (c === inString && inner[i - 1] !== '\\') inString = null;
      token += c;
      continue;
    }
    if (c === '"' || c === '\'' || c === '`') { inString = c; token += c; continue; }
    if (c === '(' || c === '[' || c === '{') { depth += 1; token += c; continue; }
    if (c === ')' || c === ']' || c === '}') { depth -= 1; token += c; continue; }
    if (depth === 0 && c === ':') {
      const m = token.replace(/\.\.\./g, '').trim().replace(/['"]/g, '').match(/([A-Za-z_$][\w$]*)\s*$/);
      if (m) keys.push(m[1]);
      token = '';
      continue;
    }
    if (depth === 0 && c === ',') { token = ''; continue; }
    token += c;
  }
  if (inner.includes('...')) hasSpread = true;
  return { keys, hasSpread };
}

function collectViolations(filePath, content) {
  const violations = [];
  const text = stripComments(content);

  for (const match of text.matchAll(CALL_PATTERN)) {
    const method = match[1];
    const openParen = match.index + match[0].length - 1;
    const arg = secondArgument(text, openParen);
    const lineNumber = text.slice(0, match.index).split('\n').length;

    if (arg.kind === 'object') {
      const { keys, hasSpread } = topLevelKeys(arg.raw);
      if (keys.includes('where')) continue;
      const bad = keys.filter((k) => !ALLOWED_KEYS.has(k));
      if (bad.length > 0) {
        violations.push({
          filePath,
          lineNumber,
          label: `db.${method}() filter [${bad.join(', ')}] passed at top level instead of under where:{...} — silently ignored`,
        });
      } else if (hasSpread) {
        // A spread without a literal `where` key: usually `...{ where }` / `...{ search }`
        // (safe). Flag only when no allowed-key spread is plausible — i.e. nothing here
        // proves intent. Conservative: do not error on spread-only to stay false-positive-free.
        continue;
      }
    } else if (arg.kind === 'identifier' && method === 'count') {
      // count(table, rawFilter) — count only reads options.where, so a bare filter
      // object passed positionally counts ALL rows.
      violations.push({
        filePath,
        lineNumber,
        label: `db.count() passed raw \`${arg.raw}\` as options — count reads only options.where; nest it as { where: ${arg.raw} }`,
      });
    }
  }

  return violations;
}

const allViolations = [];
for (const directoryPath of TARGET_DIRS) {
  if (!fs.existsSync(directoryPath)) continue;
  for (const filePath of walk(directoryPath)) {
    if (!shouldScan(filePath)) continue;
    allViolations.push(...collectViolations(filePath, fs.readFileSync(filePath, 'utf8')));
  }
}

if (allViolations.length > 0) {
  console.error('[check-db-find-where] Found db.find/db.count calls whose filter is silently ignored:\n');
  for (const v of allViolations) {
    const relativePath = path.relative(ROOT, v.filePath) || v.filePath;
    console.error(`- ${relativePath}:${v.lineNumber} ${v.label}`);
  }
  console.error('\nFix: move filter fields under `where: { ... }` (keep limit/offset/orderBy as siblings).');
  process.exit(1);
}

console.log('[check-db-find-where] OK');

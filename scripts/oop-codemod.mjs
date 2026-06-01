#!/usr/bin/env node
/**
 * Conservative codemod: convert a PURE (hook-free) function/arrow React component into a
 * hook-free React.Component class. Only transforms files that match one clean top-level
 * component pattern and contain no hooks; everything else is skipped for manual handling.
 *
 * Usage: node scripts/oop-codemod.mjs <file...>
 */
import { readFileSync, writeFileSync } from 'node:fs';

const HOOK_RE = /\buse[A-Z][A-Za-z]+\s*\(/;

/** Find the index just past the matching close brace for the `{` at openIdx. */
function matchBrace(src, openIdx) {
  let depth = 0;
  let inStr = null;
  let inTmpl = false;
  for (let i = openIdx; i < src.length; i++) {
    const c = src[i];
    const p = src[i - 1];
    if (inStr) { if (c === inStr && p !== '\\') inStr = null; continue; }
    if (inTmpl) { if (c === '`' && p !== '\\') inTmpl = false; continue; }
    if (c === '"' || c === "'") { inStr = c; continue; }
    if (c === '`') { inTmpl = true; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return i; }
  }
  return -1;
}

function convert(src) {
  if (HOOK_RE.test(src)) return { changed: false, reason: 'has hooks' };

  // Pattern A: export const Name: React.FC<TYPE> = (ARGS) => {
  let m = src.match(/export const ([A-Z][A-Za-z0-9_]*)\s*:\s*React\.FC<([^=]*?)>\s*=\s*\(([\s\S]*?)\)\s*=>\s*\{/);
  let kind = m ? 'fc' : null;
  // Pattern C: export const Name = (ARGS) => {   (no React.FC; type annotation on the arg)
  if (!m) { m = src.match(/export const ([A-Z][A-Za-z0-9_]*)\s*=\s*\(([\s\S]*?)\)\s*=>\s*\{/); if (m) kind = 'arrow'; }
  // Pattern B: export function Name(ARGS): RET? {
  if (!m) { m = src.match(/export function ([A-Z][A-Za-z0-9_]*)\s*\(([\s\S]*?)\)\s*(?::\s*[A-Za-z0-9_.<>[\] |]+)?\s*\{/); if (m) kind = 'fn'; }
  // Pattern D: export default function Name(ARGS): RET? {
  if (!m) { m = src.match(/export default function ([A-Z][A-Za-z0-9_]*)\s*\(([\s\S]*?)\)\s*(?::\s*[A-Za-z0-9_.<>[\] |]+)?\s*\{/); if (m) kind = 'default-fn'; }
  if (!m) return { changed: false, reason: 'no top-level component pattern' };

  const isArrow = kind === 'fc' || kind === 'arrow';
  const isDefaultFn = kind === 'default-fn';
  const name = m[1];
  let propsType, args;
  if (kind === 'fc') { propsType = m[2].trim(); args = m[3].trim(); }
  else {
    args = m[2].trim();
    // function X({a}: Props) / const X = ({a}: Props) → propsType is the arg's type annotation
    const ann = args.match(/:\s*([A-Za-z0-9_.<>[\] |&]+)\s*$/);
    propsType = ann ? ann[1].trim() : '{}';
    if (ann) args = args.slice(0, args.lastIndexOf(':')).trim();
  }

  const headerStart = m.index;
  const bodyOpen = src.indexOf('{', headerStart + m[0].length - 1);
  const bodyClose = matchBrace(src, bodyOpen);
  if (bodyClose === -1) return { changed: false, reason: 'unbalanced braces' };

  // Ensure this is the LAST top-level construct (avoid multi-export complications):
  const after = src.slice(bodyClose + 1).replace(/[;\s]*$/s, (isArrow ? '' : '')).trim();
  const afterClean = after.replace(/^;?\s*/, '');
  // allow a trailing `export { Name as default };` or nothing
  if (afterClean && !/^export\s*\{\s*[A-Za-z0-9_,\s]*\}\s*;?\s*$/.test(afterClean) && !/^export default [A-Za-z0-9_]+;?\s*$/.test(afterClean)) {
    return { changed: false, reason: 'content after component' };
  }

  const innerBody = src.slice(bodyOpen + 1, bodyClose);
  const destructure = args && args.startsWith('{') ? args : (args ? `${args}` : '');
  const propsLine = destructure ? `    const ${destructure} = this.props;\n` : '';

  const classKeyword = isDefaultFn ? `export default class ${name}` : `export class ${name}`;
  const classDecl =
    `${classKeyword} extends React.Component<${propsType}> {\n` +
    `  render(): React.ReactNode {\n` +
    propsLine +
    innerBody.replace(/^\n/, '').replace(/\s*$/, '') + '\n' +
    `  }\n` +
    `}`;

  const next = src.slice(0, headerStart) + classDecl + (afterClean ? '\n' + afterClean + '\n' : '\n');
  return { changed: true, next };
}

let ok = 0, skip = 0;
for (const file of process.argv.slice(2)) {
  const src = readFileSync(file, 'utf8');
  const res = convert(src);
  if (res.changed) { writeFileSync(file, res.next); console.log('OK   ', file); ok++; }
  else { console.log('SKIP ', file, '—', res.reason); skip++; }
}
console.log(`\n${ok} converted, ${skip} skipped`);

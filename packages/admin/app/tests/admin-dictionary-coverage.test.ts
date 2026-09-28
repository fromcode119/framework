import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

/**
 * The console's words, checked against the code that asks for them.
 *
 * `AdminI18n.t` falls back to English and then to the key itself, so a missing or misspelt key never
 * breaks a screen — it quietly shows English, or `settings.general.somethingTypo`, in a Bulgarian
 * console. Nothing on screen reports that, so it is checked here instead:
 *
 *  - every key the code asks for exists in `en.json`;
 *  - every key in `en.json` exists in every other dictionary;
 *  - a translation keeps the inline tags (`<code>`, `<strong>`) its English has;
 *  - a translation uses only `{{placeholders}}` the code actually passes, so it never shows a raw
 *    `{{name}}` to the operator.
 *
 * Keys are read from the syntax tree — `AdminI18n.t('…')`, `AdminI18n.optional('…')` and
 * `<AdminRichText k="…">`, including both branches of a conditional key.
 */
const ADMIN = path.resolve(__dirname, '../..');
const I18N = path.join(ADMIN, 'i18n');
const SOURCE_DIRS = ['app', 'components', 'lib'].map((dir) => path.join(ADMIN, dir));

type Dictionary = Record<string, string>;

function flatten(node: unknown, prefix = '', out: Dictionary = {}): Dictionary {
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object') flatten(value, full, out);
    else out[full] = String(value);
  }
  return out;
}

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!['node_modules', '.next', 'tests', 'i18n'].includes(entry.name)) sourceFiles(full, out);
    } else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

/** String literals a key expression can evaluate to — a literal, or either side of a conditional. */
function literalKeys(expr: ts.Expression | undefined): string[] {
  if (!expr) return [];
  if (ts.isStringLiteralLike(expr)) return [expr.text];
  if (ts.isParenthesizedExpression(expr)) return literalKeys(expr.expression);
  if (ts.isConditionalExpression(expr)) return [...literalKeys(expr.whenTrue), ...literalKeys(expr.whenFalse)];
  return [];
}

/** Property names of an inline `{ name: … }` argument, or null when the values are passed some other way. */
function passedNames(expr: ts.Expression | undefined): string[] | null {
  if (!expr) return [];
  if (!ts.isObjectLiteralExpression(expr)) return null;
  return expr.properties.flatMap((prop) => (prop.name ? [prop.name.getText().replace(/['"]/g, '')] : []));
}

interface IKeyUse {
  file: string;
  /** The placeholder names this call passes, or null when it passes them in a variable. */
  names: string[] | null;
}

function keyUses(): Map<string, IKeyUse[]> {
  const uses = new Map<string, IKeyUse[]>();
  const add = (key: string, use: IKeyUse): void => {
    if (!uses.has(key)) uses.set(key, []);
    uses.get(key)!.push(use);
  };
  for (const file of SOURCE_DIRS.flatMap((dir) => sourceFiles(dir))) {
    const sf = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const rel = path.relative(ADMIN, file);
    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node) && /^AdminI18n\.(t|optional)$/.test(node.expression.getText(sf))) {
        const names = passedNames(node.arguments[1]);
        for (const key of literalKeys(node.arguments[0])) add(key, { file: rel, names });
      }
      if ((ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) && node.tagName.getText(sf) === 'AdminRichText') {
        const attr = (name: string) => node.attributes.properties.find(
          (prop): prop is ts.JsxAttribute => ts.isJsxAttribute(prop) && prop.name.getText(sf) === name,
        );
        const keyAttr = attr('k')?.initializer;
        const varsAttr = attr('vars')?.initializer;
        const keyExpr = keyAttr && ts.isJsxExpression(keyAttr) ? keyAttr.expression : keyAttr;
        const varsExpr = varsAttr && ts.isJsxExpression(varsAttr) ? varsAttr.expression : undefined;
        for (const key of literalKeys(keyExpr as ts.Expression | undefined)) add(key, { file: rel, names: varsAttr ? passedNames(varsExpr) : [] });
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  return uses;
}

const PLACEHOLDER = /\{\{\s*(\w+)\s*\}\}/g;
const TAG = /<\/?(?:code|strong|em|b)>/g;

describe('admin dictionaries', () => {
  const en = flatten(JSON.parse(fs.readFileSync(path.join(I18N, 'en.json'), 'utf8')));
  const others = fs.readdirSync(I18N)
    .filter((name) => name.endsWith('.json') && name !== 'en.json')
    .map((name) => ({ locale: name.replace(/\.json$/, ''), words: flatten(JSON.parse(fs.readFileSync(path.join(I18N, name), 'utf8'))) }));
  const uses = keyUses();

  it('has an English entry for every key the console asks for', () => {
    const missing = [...uses.entries()]
      .filter(([key]) => !(key in en))
      .map(([key, where]) => `${key} (${where[0].file})`);
    expect(missing).toEqual([]);
  });

  it('translates every English entry into every other dictionary', () => {
    for (const { locale, words } of others) {
      expect({ locale, missing: Object.keys(en).filter((key) => !(key in words)) }).toEqual({ locale, missing: [] });
    }
  });

  it('keeps the inline tags of the English sentence', () => {
    for (const { locale, words } of others) {
      const broken = Object.keys(en).filter((key) => key in words
        && [...en[key].matchAll(TAG)].map(String).sort().join() !== [...words[key].matchAll(TAG)].map(String).sort().join());
      expect({ locale, broken }).toEqual({ locale, broken: [] });
    }
  });

  it('uses only placeholders the code passes', () => {
    const problems: string[] = [];
    for (const [key, where] of uses) {
      const passed = where.every((use) => use.names !== null)
        ? new Set(where.flatMap((use) => use.names ?? []))
        : null;
      if (!passed) continue;
      for (const { locale, words } of [{ locale: 'en', words: en }, ...others]) {
        const text = words[key];
        if (text === undefined) continue;
        for (const match of text.matchAll(PLACEHOLDER)) {
          if (!passed.has(match[1])) problems.push(`${locale} ${key}: {{${match[1]}}} is never passed (${where[0].file})`);
        }
      }
    }
    expect(problems).toEqual([]);
  });
});

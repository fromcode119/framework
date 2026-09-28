import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

/**
 * The assistant's words, checked against the code that asks for them: every `AiText.t('…')` key exists
 * in English, and every English key in every other dictionary with the same placeholders.
 */
const SRC = path.resolve(__dirname, '../src');
const flatten = (node: Record<string, unknown>, prefix = '', out: Record<string, string> = {}) => {
  for (const [key, value] of Object.entries(node)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object') flatten(value as Record<string, unknown>, full, out);
    else out[full] = String(value);
  }
  return out;
};
const files = (dir: string, out: string[] = []): string[] => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files(full, out);
    else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
};
const keysAsked = (): string[] => {
  const keys = new Set<string>();
  for (const file of files(SRC)) {
    const sf = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node) && node.expression.getText(sf) === 'AiText.t' && node.arguments[0] && ts.isStringLiteralLike(node.arguments[0])) {
        keys.add(node.arguments[0].text);
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  return [...keys];
};
const dictionary = (locale: string) => flatten(JSON.parse(fs.readFileSync(path.join(SRC, 'i18n', `${locale}.json`), 'utf8')));

describe('assistant dictionaries', () => {
  const en = dictionary('en');
  const others = fs.readdirSync(path.join(SRC, 'i18n')).filter((name) => name.endsWith('.json') && name !== 'en.json').map((name) => name.replace('.json', ''));

  it('has an English entry for every key the assistant asks for', () => {
    expect(keysAsked().filter((key) => !(key in en))).toEqual([]);
  });

  it('translates every English entry with the same placeholders', () => {
    const placeholders = (text: string) => [...text.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]).sort().join();
    for (const locale of others) {
      const words = dictionary(locale);
      const problems = Object.keys(en).filter((key) => !(key in words) || placeholders(en[key]) !== placeholders(words[key]));
      expect({ locale, problems }).toEqual({ locale, problems: [] });
    }
  });
});

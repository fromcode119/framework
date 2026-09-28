import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { DictionaryParityGuard } from '../src/dictionary-parity-guard';
import { RenderedCopyGuard } from '../src/rendered-copy-guard';

/** A locale that lacks an English entry shows English in its place — caught here, not on a live site. */
describe('DictionaryParityGuard', () => {
  let root = '';

  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true });
    root = '';
  });

  const dictionary = (dir: string, files: Record<string, unknown>): string => {
    const folder = path.join(root, dir, 'i18n');
    mkdirSync(folder, { recursive: true });
    for (const [name, words] of Object.entries(files)) writeFileSync(path.join(folder, name), JSON.stringify(words));
    return folder;
  };

  it('finds the dictionary folders by their en.json, and skips build output', () => {
    root = mkdtempSync(path.join(tmpdir(), 'i18n-parity-'));
    const ui = dictionary('shop/src/ui', { 'en.json': { a: 'A' } });
    dictionary('shop/node_modules/x', { 'en.json': { a: 'A' } });
    dictionary('shop/src/other', { 'bg.json': { a: 'А' } });
    expect(DictionaryParityGuard.folders(root)).toEqual([ui]);
  });

  it('names every key a locale is missing or leaves empty', () => {
    root = mkdtempSync(path.join(tmpdir(), 'i18n-parity-'));
    const folder = dictionary('shop', {
      'en.json': { shop: { save: 'Save', cancel: 'Cancel', title: 'Orders {{count}}' } },
      'bg.json': { shop: { save: 'Запази', title: '' } },
    });
    expect(DictionaryParityGuard.problemsIn(folder)).toEqual(['bg.json: 1 missing — shop.cancel', 'bg.json: 1 empty — shop.title']);
  });

  it('accepts a translation that uses its own placeholders', () => {
    root = mkdtempSync(path.join(tmpdir(), 'i18n-parity-'));
    const folder = dictionary('shop', { 'en.json': { list: 'Search {{name}}…' }, 'bg.json': { list: 'Търсене в „{{label}}“…' } });
    expect(DictionaryParityGuard.problemsIn(folder)).toEqual([]);
  });
});

describe('RenderedCopyGuard.isEnforced', () => {
  let root = '';

  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true });
    root = '';
  });

  it('enforces an extension UI that ships its own dictionary, and only that one', () => {
    root = mkdtempSync(path.join(tmpdir(), 'rendered-copy-enforced-'));
    mkdirSync(path.join(root, 'shop/src/ui/i18n'), { recursive: true });
    writeFileSync(path.join(root, 'shop/src/ui/i18n/en.json'), '{}');
    mkdirSync(path.join(root, 'blog/src/ui'), { recursive: true });
    expect(RenderedCopyGuard.isEnforced(path.join(root, 'shop/src/ui/pages/orders.tsx'))).toBe(true);
    expect(RenderedCopyGuard.isEnforced(path.join(root, 'blog/src/ui/pages/posts.tsx'))).toBe(false);
    expect(RenderedCopyGuard.isEnforced('/x/framework/packages/admin/app/page.tsx')).toBe(true);
  });

  it('scans a .ts option list only inside a translated extension UI', () => {
    root = mkdtempSync(path.join(tmpdir(), 'rendered-copy-ts-'));
    for (const name of ['shop', 'blog']) {
      mkdirSync(path.join(root, name, 'src/ui'), { recursive: true });
      writeFileSync(path.join(root, name, 'src/ui/options.ts'), "export class Options { static readonly ALL = [{ label: 'Pending review', value: 'pending' }]; }");
    }
    mkdirSync(path.join(root, 'shop/src/ui/i18n'), { recursive: true });
    writeFileSync(path.join(root, 'shop/src/ui/i18n/en.json'), '{}');
    const { detail } = RenderedCopyGuard.scan([{ area: 'plugins', dir: root }]);
    expect(detail.map(({ file }) => path.relative(root, file))).toEqual([path.join('shop', 'src/ui/options.ts')]);
  });
});

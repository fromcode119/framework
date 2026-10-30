import { afterEach, describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { PluginInstallProgressCopy } from '@/lib/plugin-install-progress-copy';
import en from '@/i18n/en.json';
import bg from '@/i18n/bg.json';

const operation = (extra: Record<string, unknown>) => ({
  id: 'op', pluginSlug: 'shop', kind: 'marketplace install', status: 'running', phase: 'extracting-package',
  message: 'Extracting "shop" package...', startedAt: '', updatedAt: '', dependencySlugs: [], migrationNames: [], ...extra,
}) as any;

/** A Bulgarian console showed "EXTRACTING "SHOP" PACKAGE..." while installing: the api's log English. */
describe('PluginInstallProgressCopy', () => {
  afterEach(() => AdminI18n.setLocale('en'));

  it("words a step in the console's language with the values the api named", () => {
    AdminI18n.setLocale('bg');
    expect(PluginInstallProgressCopy.localize(operation({ messageKey: 'extracting', messageParams: { pluginSlug: 'shop' } })).message)
      .toBe('Разархивиране на пакета „shop“...');
    expect(PluginInstallProgressCopy.localize(operation({ messageKey: 'updatingPlugin', messageParams: { remaining: 2, pluginSlug: 'shop', version: '1.2.0' } })).message)
      .toBe('Остават 2 — обновяване на shop до v1.2.0...');
  });

  it("keeps the api's words for a step without a key or one the dictionary lacks", () => {
    AdminI18n.setLocale('bg');
    expect(PluginInstallProgressCopy.localize(operation({})).message).toBe('Extracting "shop" package...');
    expect(PluginInstallProgressCopy.localize(operation({ messageKey: 'notAStep' })).message).toBe('Extracting "shop" package...');
  });

  it('has words in every console language for every step the api reports', () => {
    const roots = ['../../../core/src', '../../../api/src'].map((dir) => path.resolve(__dirname, dir));
    const keys = new Set<string>();
    const walk = (dir: string) => fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { if (entry.name !== 'tests') walk(full); return; }
      if (!entry.name.endsWith('.ts')) return;
      for (const match of fs.readFileSync(full, 'utf8').matchAll(/messageKey(?:\s*=|:)\s*'([A-Za-z]+)'/g)) keys.add(match[1]);
    });
    roots.forEach(walk);
    expect(keys.size).toBeGreaterThan(20);
    for (const dictionary of [en, bg] as any[]) {
      expect([...keys].filter((key) => !dictionary.plugins.installProgress[key])).toEqual([]);
    }
  });
});

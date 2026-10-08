import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nContextProxy } from '@core/plugin/context/i18n';

/**
 * `registerTranslations(dir)` read every `.json` in a directory and served it through the public
 * translations endpoint. Only a LEADING `..` was refused, so `x/../..` — or a symlink shipped in an
 * uploaded plugin — read JSON from anywhere on the host. The directory must stay inside the plugin.
 */
describe('context.i18n.registerTranslations(directory)', () => {
  let root = '';
  let pluginRoot = '';

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'fc-i18n-'));
    pluginRoot = path.join(root, 'plugins', 'shop');
    fs.mkdirSync(path.join(pluginRoot, 'i18n'), { recursive: true });
    fs.mkdirSync(path.join(pluginRoot, 'x'), { recursive: true });
    fs.writeFileSync(path.join(pluginRoot, 'i18n', 'en.json'), JSON.stringify({ hello: 'Hello' }));
    fs.mkdirSync(path.join(root, 'secrets'));
    fs.writeFileSync(path.join(root, 'secrets', 'config.json'), JSON.stringify({ password: 'hunter2' }));
  });

  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  function setup() {
    const registered: Array<[string, string, unknown]> = [];
    const manager = {
      i18n: { registerTranslations: vi.fn((locale: string, ns: string, map: unknown) => registered.push([locale, ns, map])) },
      writeLog: vi.fn(async () => undefined),
      themeManager: null,
    } as any;
    const security = { hasCapability: () => true, handleViolation: () => {}, handleRateLimit: () => {} } as any;
    const i18n = I18nContextProxy.createI18nProxy({ manifest: { slug: 'shop' } } as any, manager, { currentPluginRoot: pluginRoot } as any, security) as any;
    return { i18n, registered };
  }

  it('registers the plugin’s own translations', () => {
    const { i18n, registered } = setup();

    i18n.registerTranslations('i18n');

    expect(registered).toEqual([['en', 'shop', { hello: 'Hello' }]]);
  });

  it('refuses a path that climbs out after a first segment', () => {
    const { i18n, registered } = setup();

    i18n.registerTranslations('x/../../../secrets');

    expect(registered).toEqual([]);
  });

  it('refuses a symlink that points outside the plugin', () => {
    fs.symlinkSync(path.join(root, 'secrets'), path.join(pluginRoot, 'linked'));
    const { i18n, registered } = setup();

    i18n.registerTranslations('linked');

    expect(registered).toEqual([]);
  });

  it('refuses a translation file that is itself a symlink out', () => {
    fs.symlinkSync(path.join(root, 'secrets', 'config.json'), path.join(pluginRoot, 'i18n', 'de.json'));
    const { i18n, registered } = setup();

    i18n.registerTranslations('i18n');

    expect(registered.map(([locale]) => locale)).toEqual(['en']);
  });
});

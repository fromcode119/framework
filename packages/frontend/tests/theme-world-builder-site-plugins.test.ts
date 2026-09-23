import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeServerRegistry } from '@/lib/ssr/theme-server-registry';
import { ThemeSsrGeneration } from '@/lib/ssr/theme-ssr-generation';
import { ThemeSsrRuntime } from '@/lib/ssr/theme-ssr-runtime';
import { ThemeWorldBuilder } from '@/lib/ssr/theme-world-builder';

/**
 * The regression this guards: a site's contact page never rendered. The plugins directory is shared by
 * every site on a deployment, and the server world imported EVERY plugin server bundle on disk — so a
 * plugin the site does not run (forms) registered its `cms.block.contact-form` override server-side.
 * The server rendered the form, the browser (which loads only the site's plugins) rendered the theme's
 * skeleton fallback, hydration failed with React #418 and the page stayed on the skeleton.
 */
describe('ThemeWorldBuilder — a world holds only the site\'s plugins', () => {
  let root = '';
  let imported: string[] = [];

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'fc-world-'));
    for (const slug of ['alpha', 'beta', 'gamma']) {
      mkdirSync(join(root, 'plugins', slug, 'ui-ssr'), { recursive: true });
      writeFileSync(join(root, 'plugins', slug, 'ui-ssr', 'entry.mjs'), '');
    }
    mkdirSync(join(root, 'themes', 'example-theme', 'ui-ssr'), { recursive: true });
    writeFileSync(join(root, 'themes', 'example-theme', 'ui-ssr', 'entry.mjs'), '');

    imported = [];
    vi.spyOn(ThemeSsrRuntime, 'themesDir').mockReturnValue(join(root, 'themes'));
    vi.spyOn(ThemeSsrRuntime, 'pluginsDir').mockReturnValue(join(root, 'plugins'));
    vi.spyOn(ThemeSsrRuntime, 'load').mockResolvedValue({ contextBridge: {}, wrapOverride: (c: unknown) => c } as never);
    vi.spyOn(ThemeSsrRuntime, 'importRuntimeModule').mockImplementation(async (path: string) => {
      imported.push(path);
      return {};
    });
    vi.spyOn(ThemeServerRegistry, 'install').mockImplementation(() => undefined);
    vi.spyOn(ThemeServerRegistry, 'beginGeneration').mockReturnValue({
      payloadFor: () => ({}),
      warmOverrides: async () => undefined,
    } as never);
    vi.spyOn(ThemeServerRegistry, 'publishGeneration').mockImplementation(() => undefined);
    vi.spyOn(ThemeServerRegistry, 'publishedSignatures').mockReturnValue([]);
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(root, { recursive: true, force: true });
  });

  const importedPluginSlugs = () => imported
    .filter((path) => path.includes(`${join(root, 'plugins')}`))
    .map((path) => path.split('/').slice(-3)[0])
    .sort();

  it('imports only the server bundles of the plugins the site runs', async () => {
    const generation = ThemeSsrGeneration.from({
      activeTheme: { slug: 'example-theme', version: '1.0.0' },
      plugins: [{ slug: 'alpha', version: '1.0.0' }, { slug: 'gamma', version: '2.0.0' }],
    });
    await ThemeWorldBuilder.build(generation, 'http://api.example.test');
    expect(importedPluginSlugs()).toEqual(['alpha', 'gamma']);
  });

  it('imports no plugin bundle for a site that runs none', async () => {
    const generation = ThemeSsrGeneration.from({ activeTheme: { slug: 'example-theme', version: '1.0.0' }, plugins: [] });
    await ThemeWorldBuilder.build(generation, 'http://api.example.test');
    expect(importedPluginSlugs()).toEqual([]);
    // The theme itself still loads — only the plugin set is narrowed.
    expect(imported.some((path) => path.includes(join(root, 'themes', 'example-theme')))).toBe(true);
  });
});

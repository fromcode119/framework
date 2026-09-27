import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PluginPathContextProxy } from '@core/plugin/context/paths';

/**
 * A plugin's template (an email, a page fragment) comes from the theme the CURRENT site renders with.
 *
 * It was read from the platform `_system_themes` row, which names the platform's own theme. On a
 * multi-site deployment every site's plugin emails therefore looked for overrides in the platform's
 * theme, found none, and fell back to the plugin's default — a site's own overrides were never used.
 */
describe('plugin templates use the site\'s theme', () => {
  let root: string;
  const previousThemesDir = process.env.THEMES_DIR;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'plugin-template-'));
    for (const slug of ['platform-theme', 'site-theme']) {
      const dir = path.join(root, 'themes', slug);
      fs.mkdirSync(path.join(dir, 'src/overrides/plugins/org.example/shop/emails'), { recursive: true });
      fs.writeFileSync(path.join(dir, 'theme.json'), JSON.stringify({ slug, name: slug, version: '1.0.0' }));
      fs.writeFileSync(path.join(dir, 'src/overrides/plugins/org.example/shop/emails/receipt.html'), `${slug} receipt`);
    }
    const pluginDir = path.join(root, 'plugins', 'shop', 'src', 'templates', 'emails');
    fs.mkdirSync(pluginDir, { recursive: true });
    fs.writeFileSync(path.join(pluginDir, 'receipt.html'), 'plugin default receipt');
    process.env.THEMES_DIR = path.join(root, 'themes');
  });

  afterEach(() => {
    if (previousThemesDir === undefined) delete process.env.THEMES_DIR;
    else process.env.THEMES_DIR = previousThemesDir;
  });

  const plugin = () => ({ manifest: { slug: 'shop', namespace: 'org.example' }, path: path.join(root, 'plugins', 'shop') } as any);
  const platformRow = { findOne: async () => ({ slug: 'platform-theme' }) };

  it("reads the override of the theme the request's site is using, not the platform's", async () => {
    const paths = new PluginPathContextProxy(plugin(), {
      db: platformRow,
      themeManager: { getActiveThemeManifest: () => ({ slug: 'site-theme' }), getThemeConfig: async () => ({}) },
    } as any);
    await expect(paths.readCurrentPluginTemplate('emails/receipt.html')).resolves.toBe('site-theme receipt');
  });

  it("a site with no theme gets the plugin's own template", async () => {
    const paths = new PluginPathContextProxy(plugin(), {
      db: platformRow,
      themeManager: { getActiveThemeManifest: () => null, getThemeConfig: async () => ({}) },
    } as any);
    await expect(paths.readCurrentPluginTemplate('emails/receipt.html')).resolves.toBe('plugin default receipt');
  });

  it('without a theme manager (a CLI) the platform row is the answer', async () => {
    const paths = new PluginPathContextProxy(plugin(), { db: platformRow, themeManager: null } as any);
    await expect(paths.readCurrentPluginTemplate('emails/receipt.html')).resolves.toBe('platform-theme receipt');
  });
});

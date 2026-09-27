import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, expect, it, vi } from 'vitest';
import { PluginGuestPaths } from '@core/plugin/host/plugin-guest-paths';

/**
 * A plugin process has its own files but none of the sites' themes, so a read a theme may override
 * has to be answered by the host — otherwise every email went out in the plugin's default design
 * whatever the site's theme shipped.
 */
describe('context.paths in a plugin process', () => {
  const pluginDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guest-paths-'));
  fs.mkdirSync(path.join(pluginDir, 'src/templates/emails'), { recursive: true });
  fs.writeFileSync(path.join(pluginDir, 'src/templates/emails/receipt.html'), 'plugin default');
  fs.writeFileSync(path.join(pluginDir, 'own.txt'), 'own file');
  const plugin = { manifest: { slug: 'shop', namespace: 'org.example' }, path: pluginDir } as any;

  function guestPaths() {
    const host = {
      readCurrentPluginText: vi.fn(async () => 'theme override'),
      readCurrentPluginJson: vi.fn(async () => ({ from: 'host' })),
    };
    const paths = new PluginGuestPaths(plugin, { themeManager: null } as any, async () => 'site-theme', host);
    return { paths, host };
  }

  it('a template a theme may override is read by the host, with the theme directory it may be in', async () => {
    const { paths, host } = guestPaths();
    await expect(paths.readCurrentPluginTemplate('emails/receipt.html')).resolves.toBe('theme override');
    expect(host.readCurrentPluginText).toHaveBeenCalledWith('emails/receipt.html', {
      pluginDirectory: 'src/templates',
      themeDirectory: 'src/overrides/plugins/org.example/shop',
    });
  });

  it("a read of the plugin's own files alone stays in the process", async () => {
    const { paths, host } = guestPaths();
    await expect(paths.readCurrentPluginText('own.txt')).resolves.toBe('own file');
    expect(host.readCurrentPluginText).not.toHaveBeenCalled();
  });

  it('a JSON a theme may override is read by the host too', async () => {
    const { paths, host } = guestPaths();
    await expect(paths.readCurrentPluginJson('contact.json', { themeDirectory: 'src/overrides/plugins/org.example/shop' })).resolves.toEqual({ from: 'host' });
    expect(host.readCurrentPluginJson).toHaveBeenCalled();
  });
});

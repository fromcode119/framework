import { describe, expect, it } from 'vitest';
import { PluginManager } from '@core/plugin/plugin-manager';
import { Logger } from '@core/logging';

/**
 * `context.theme.*` resolves through `manager.themeManager`. The API constructs a `ThemeManager` at boot
 * and handed it only to the HTTP server — nothing ever set it on the plugin manager, so every plugin's
 * `context.theme.getActiveSlug()` was null and `getActiveConfig()` / `getCurrentPluginSettings()` were
 * `{}` on every install. The forms plugin therefore ignored a theme's `contactFormDefaults` and created
 * its own five-field contact form, which rejected a three-field theme form with 422. These tests pin the
 * hand-off on the manager itself, through the same `createContext` a booting plugin goes through.
 */
describe('PluginManager theme context', () => {
  const activeConfig = {
    variables: { siteName: 'Starter Site', contactEmail: 'hello@example.com' },
    settings: {
      forms: {
        contactFormDefaults: {
          title: 'Contact',
          fields: [
            { name: 'name', label: 'Name', type: 'text', required: true },
            { name: 'email', label: 'Email', type: 'email', required: true },
            { name: 'message', label: 'Message', type: 'textarea', required: true },
          ],
        },
      },
    },
  };

  /** The manager without its constructor: these tests are about the hand-off, not about booting a manager. */
  function managerWithoutConstructor(): any {
    const manager = Object.create(PluginManager.prototype);
    manager.logger = new Logger({ namespace: 'test' });
    manager.plugins = new Map();
    manager.pluginsRoot = '/tmp/plugins';
    manager.headInjections = new Map();
    manager.registeredCollections = new Map();
    // The context proxies wrap these at creation time; the theme proxy never reads them.
    manager.db = {};
    manager.jobs = {};
    manager.integrations = {};
    manager.auth = null;
    manager.hooks = { on: () => {}, emit: () => {} };
    return manager;
  }

  function themeManagerStub(): any {
    return {
      getActiveThemeManifest: () => ({ slug: 'starter' }),
      getThemeConfig: async (slug: string) => (slug === 'starter' ? activeConfig : {}),
    };
  }

  const plugin: any = { manifest: { slug: 'forms', namespace: 'org.fromcode', capabilities: [] }, state: 'active' };

  it('exposes the active theme slug, config and plugin settings to a plugin context once the theme manager is set', async () => {
    const manager = managerWithoutConstructor();
    manager.setThemeManager(themeManagerStub());

    const context = manager.createContext(plugin);

    await expect(context.theme.getActiveSlug()).resolves.toBe('starter');
    await expect(context.theme.getActiveConfig()).resolves.toEqual(activeConfig);
    await expect(context.theme.getCurrentPluginSettings()).resolves.toEqual(activeConfig.settings.forms);
  });

  it('starts with no theme manager, so an unwired context resolves to nothing rather than a made-up theme', async () => {
    const manager = managerWithoutConstructor();


    const context = manager.createContext(plugin);

    await expect(context.theme.getActiveSlug()).resolves.toBeNull();
    await expect(context.theme.getActiveConfig()).resolves.toEqual({});
    await expect(context.theme.getCurrentPluginSettings()).resolves.toEqual({});
  });
});

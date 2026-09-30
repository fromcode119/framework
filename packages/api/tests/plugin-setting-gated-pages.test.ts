import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CoreServices, ServerCoreServices } from '@fromcode119/core';
import { PluginSettingGatedPages } from '@api/controllers/plugins/plugin-setting-gated-pages';

/**
 * Turning on a setting that gates a default page creates that page for the site being edited; any
 * other save leaves pages alone.
 */
describe('pages switched on by a plugin setting', () => {
  beforeEach(() => {
    ServerCoreServices.register();
    CoreServices.reset();
    CoreServices.getInstance().defaultPageContracts.register({
      namespace: 'org.synthetic',
      pluginSlug: 'shop',
      contracts: [{
        key: 'withdrawal', capability: 'shop', kind: 'form-page', recipe: 'shop.withdrawal', defaultSlug: '/withdrawal',
        materializationMode: 'singleton-document', required: true, adoptionHints: [], dependencies: [], enabledBySetting: 'withdrawalEnabled',
      }] as any,
    });
  });

  const run = async (oldSettings: Record<string, unknown>, newSettings: Record<string, unknown>) => {
    const manager = { materializeDefaultPages: vi.fn(async () => undefined) };
    const plugin = { manifest: { namespace: 'org.synthetic', slug: 'shop' } };
    await new PluginSettingGatedPages(manager as any, { error: vi.fn() } as any).afterSave(plugin as any, oldSettings, newSettings);
    return manager.materializeDefaultPages.mock.calls.length;
  };

  it('materializes when the gating setting is switched on', async () => {
    expect(await run({ withdrawalEnabled: false }, { withdrawalEnabled: true })).toBe(1);
    expect(await run({}, { withdrawalEnabled: true })).toBe(1);
  });

  it('does nothing when it stays on, stays off, or is switched off', async () => {
    expect(await run({ withdrawalEnabled: true }, { withdrawalEnabled: true })).toBe(0);
    expect(await run({}, { other: 1 })).toBe(0);
    expect(await run({ withdrawalEnabled: true }, { withdrawalEnabled: false })).toBe(0);
  });
});

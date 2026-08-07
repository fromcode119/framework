import { PluginState } from '@fromcode119/core';
import { SystemController } from '@api/controllers/system/system-controller';

describe('SystemController.getAdminMetadata secondaryPanel propagation', () => {
  const createController = (metadata: any) => {
    const manager: any = {
      hooks: { on: vi.fn() },
      getAdminMetadata: vi.fn().mockResolvedValue(metadata),
      getRuntimeModules: vi.fn().mockReturnValue({}),
      db: {
        find: vi.fn().mockResolvedValue([]),
      },
    };
    const themeManager: any = {
      getFrontendMetadata: vi.fn().mockResolvedValue({}),
    };
    const restController: any = {};
    const auth: any = {};
    return { controller: new SystemController(manager, themeManager, restController, auth), manager };
  };

  it('preserves secondaryPanel when present in manager metadata payload', async () => {
    const payload = {
      plugins: [],
      menu: [],
      secondaryPanel: {
        version: 1,
        contexts: { 'org.fromcode:finance': { id: 'org.fromcode:finance' } },
        itemsByContext: {},
        globalItems: [],
        policy: { allowlistKey: 'admin.secondaryPanel.allowlist.v1', allowlistEntries: 1, evaluatedAt: '2026-04-02T00:00:00.000Z' },
        precedence: { scopeOrder: ['self', 'plugin-target', 'global'], tieBreakOrder: ['priority-asc', 'canonicalId-asc'] },
      },
    };
    const { controller } = createController(payload);
    const req: any = {};
    const res: any = { json: vi.fn(), set: vi.fn().mockReturnThis(), status: vi.fn().mockReturnThis() };

    await controller.getAdminMetadata(req, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      secondaryPanel: payload.secondaryPanel,
    }));
  });

  it('injects default secondaryPanel shape when field is absent', async () => {
    const { controller } = createController({ plugins: [], menu: [] });
    const req: any = {};
    const res: any = { json: vi.fn(), set: vi.fn().mockReturnThis(), status: vi.fn().mockReturnThis() };

    await controller.getAdminMetadata(req, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      secondaryPanel: expect.objectContaining({
        version: 1,
        contexts: {},
        itemsByContext: {},
        globalItems: [],
        policy: expect.objectContaining({
          allowlistKey: 'admin.secondaryPanel.allowlist.v1',
        }),
        precedence: {
          scopeOrder: ['self', 'plugin-target', 'global'],
          tieBreakOrder: ['priority-asc', 'canonicalId-asc'],
        },
      }),
    }));
  });
});

/**
 * `getFrontendMetadata` is served UNAUTHENTICATED, so everything it returns is public by definition.
 * This suite is the guard on that boundary.
 *
 * It was dark: the fake manager had no `getPublicFrontendPluginSettings`, a method production started
 * calling, so the test died with `TypeError: … is not a function` before reaching a single whitelist
 * assertion. The endpoint has TWO settings channels — `publicSettings` (framework meta keys, filtered by
 * `PublicFrontendSettingsService.PUBLIC_KEYS`, a deny-by-default allowlist) and `settings` (per-plugin
 * fields flagged `public: true`). Both are asserted here so neither can start leaking unnoticed.
 */
describe('SystemController.getFrontendMetadata public settings', () => {
  it('returns only whitelisted public settings', async () => {
    const pluginPublicSettings = { 'org.fromcode/demo': { publicFlag: 'on' } };
    const manager: any = {
      hooks: { on: vi.fn() },
      getAdminMetadata: vi.fn().mockResolvedValue({ menu: [] }),
      getRuntimeModules: vi.fn().mockReturnValue({}),
      // Real `PluginState` MEMBERS, because production filters with `plugin.state === PluginState.ACTIVE`
      // — an identity check against a reactor `Enum` singleton that a raw `'active'` string can never
      // satisfy. The inactive plugin proves the filter is real: a disabled plugin must not be advertised
      // on an unauthenticated endpoint.
      getPlugins: vi.fn().mockReturnValue([
        { state: PluginState.ACTIVE, manifest: { namespace: 'org.fromcode', slug: 'demo', version: '1.0.0', name: 'Demo' } },
        { state: PluginState.INACTIVE, manifest: { namespace: 'org.fromcode', slug: 'disabled', version: '1.0.0', name: 'Disabled' } },
      ]),
      getSortedPlugins: vi.fn().mockImplementation((plugins: any[]) => plugins),
      getHeadInjections: vi.fn().mockReturnValue([]),
      getPublicFrontendPluginSettings: vi.fn().mockResolvedValue(pluginPublicSettings),
      db: {
        find: vi.fn().mockResolvedValue([
          { key: 'routing_home_target', value: 'auto' },
          { key: 'locale_url_strategy', value: 'query' },
          { key: 'default_locale', value: 'bg' },
          { key: 'fallback_locale', value: 'bg' },
          { key: 'frontend_default_locale', value: 'bg' },
          { key: 'frontend_auth_enabled', value: 'true' },
          { key: 'auth_password_history', value: '5' },
          { key: 'totp_secret_pending', value: 'secret' },
        ]),
      },
    };
    const themeManager: any = {
      getFrontendMetadata: vi.fn().mockResolvedValue({ activeTheme: null }),
    };
    const restController: any = {};
    const auth: any = {};
    const controller = new SystemController(manager, themeManager, restController, auth);
    const req: any = {};
    const res: any = { json: vi.fn(), set: vi.fn().mockReturnThis(), status: vi.fn().mockReturnThis() };

    await controller.getFrontendMetadata(req, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      publicSettings: {
        routing_home_target: 'auto',
        locale_url_strategy: 'query',
        default_locale: 'bg',
        fallback_locale: 'bg',
        frontend_default_locale: 'bg',
        frontend_auth_enabled: 'true',
      },
    }));
    const response = res.json.mock.calls[0][0];
    expect(response.publicSettings.auth_password_history).toBeUndefined();
    expect(response.publicSettings.totp_secret_pending).toBeUndefined();

    // The per-plugin public-settings channel is forwarded verbatim — the fake must be exercised, not
    // merely present, or restoring the method would silently paper over the surface it guards.
    expect(manager.getPublicFrontendPluginSettings).toHaveBeenCalled();
    expect(response.settings).toEqual(pluginPublicSettings);

    // Only ACTIVE plugins are advertised on the unauthenticated endpoint.
    expect(response.plugins.map((plugin: any) => plugin.slug)).toEqual(['demo']);
  });
});

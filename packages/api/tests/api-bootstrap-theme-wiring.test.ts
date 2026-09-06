import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Regression guard for the boot hand-off that was missing entirely: `ApiBootstrapService` built the
 * `ThemeManager`, gave it to the HTTP server, and never told the `PluginManager` about it. Every plugin's
 * `context.theme.*` then resolved to null / `{}` for the life of the process. The order matters as much
 * as the call: the hand-off must land BEFORE `discoverPlugins()` boots the plugins that read it in onInit.
 */
const calls: string[] = [];

const managerInstance = {
  db: null,
  setApiHost: vi.fn(),
  init: vi.fn(async () => { calls.push('manager.init'); }),
  setThemeArchiveInstaller: vi.fn(),
  setCoreArchiveInstaller: vi.fn(),
  setAuth: vi.fn(),
  setThemeManager: vi.fn((themeManager: unknown) => { calls.push('manager.setThemeManager'); managerInstance.wired = themeManager; }),
  discoverPlugins: vi.fn(async () => { calls.push('manager.discoverPlugins'); }),
  wired: null as unknown,
};

const themeManagerInstance = {
  init: vi.fn(async () => { calls.push('themeManager.init'); }),
  ensureActiveThemeDependencies: vi.fn(async () => {}),
  installFromZip: vi.fn(),
  activateTheme: vi.fn(),
};

vi.mock('dotenv', () => ({ default: { config: () => {} } }));
vi.mock('express', () => ({ default: { Router: () => ({ use: () => {} }) } }));
vi.mock('@fromcode119/auth', () => ({ AuthManager: class { constructor(public secret: string) {} } }));
vi.mock('@api/services/framework-account-page-contract-service', () => ({
  FrameworkAccountPageContractService: { register: () => {} },
}));
vi.mock('@fromcode119/core', () => ({
  HotReloadService: class { start() {} },
  LocalizationUtils: { normalizeLocaleCode: () => '' },
  Logger: class { info() {} warn() {} error() {} },
  PluginManager: class { constructor() { return managerInstance; } },
  PlatformSettingsService: { registerAccessor: () => {} },
  ServerCoreServices: { register: () => {} },
  SystemConstants: { TABLE: { META: '_system_meta' }, META_KEY: { DEFAULT_LOCALE: 'default_locale' } },
  SystemRedirectService: { register: () => {} },
  SystemUpdateService: { applyArchive: async () => {} },
  ThemeManager: class { constructor() { return themeManagerInstance; } },
}));

describe('ApiBootstrapService theme manager wiring', () => {
  beforeEach(() => {
    calls.length = 0;
    managerInstance.wired = null;
    process.env.JWT_SECRET = 'test-secret';
    process.env.NODE_ENV = 'test';
  });

  it('hands the theme manager to the plugin manager before any plugin boots', async () => {
    const { ApiBootstrapService } = await import('@api/server/api-bootstrap-service');
    const server = {
      pluginRouter: { use: () => {} },
      initialize: async () => {},
      setupPluginCollectionProxy: () => {},
      start: () => {},
    };

    await new ApiBootstrapService().bootstrap(() => server);

    expect(managerInstance.setThemeManager).toHaveBeenCalledTimes(1);
    expect(managerInstance.wired).toBe(themeManagerInstance);
    expect(calls.indexOf('manager.setThemeManager')).toBeGreaterThan(-1);
    expect(calls.indexOf('manager.setThemeManager')).toBeLessThan(calls.indexOf('manager.discoverPlugins'));
  });
});

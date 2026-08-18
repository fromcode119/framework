import dotenv from 'dotenv';
import express from 'express';
import { AuthManager } from '@fromcode119/auth';
import { HotReloadService, LocalizationUtils, Logger, PluginManager, PlatformSettingsService, ServerCoreServices, SystemConstants, SystemRedirectService, SystemUpdateService, ThemeManager } from '@fromcode119/core';
import { FrameworkAccountPageContractService } from '@api/services/framework-account-page-contract-service';

export class ApiBootstrapService {
  private logger = new Logger({ namespace: 'api-bootstrap-service' });

  /**
   * Set the i18n default locale from `_system_meta`, the store admin Settings → Localization writes.
   * Silent when unset or unreadable: an unconfigured locale must not stop the server booting.
   */
  private static async seedPlatformLocale(manager: PluginManager): Promise<void> {
    try {
      const db = (manager as any).db; // eslint-disable-line @typescript-eslint/no-explicit-any
      if (!db || !(await db.tableExists(SystemConstants.TABLE.META))) return;
      const row = await db.findOne(SystemConstants.TABLE.META, { key: SystemConstants.META_KEY.DEFAULT_LOCALE });
      const locale = LocalizationUtils.normalizeLocaleCode(String(row?.value || ''), { short: true });
      if (locale) (manager as any).i18n.setLocale(locale); // eslint-disable-line @typescript-eslint/no-explicit-any
    } catch {
      // A locale that cannot be read is not a reason to fail boot.
    }
  }

  async bootstrap(
    createServer: (manager: PluginManager, themeManager: ThemeManager, auth: AuthManager) => any,
  ): Promise<void> {
    dotenv.config();
    // FIRST, before anything can resolve a core service. `CoreServices` reaches the server-only ones
    // through a registry rather than importing them (so browser bundles stay ~47 KB lighter), and
    // plugins hit the very first of them — `defaultPageContracts.register(...)` — inside
    // `manager.init()` below. Registering later than this throws on plugin boot.
    ServerCoreServices.register();

    const manager = new PluginManager();
    const pluginApiRouter = express.Router();
    manager.setApiHost(pluginApiRouter);

    await manager.init();

    // Let platform settings (non-secret, non-bootstrap config) fall back to the
    // `_system_meta` store when their env var is unset, so they can be changed from the
    // admin Settings page without a redeploy. Env always wins (see PlatformSettingsService).
    PlatformSettingsService.registerAccessor(async (key: string) => {
      const db = (manager as any).db;
      if (!db || !(await db.tableExists(SystemConstants.TABLE.META))) return null;
      const row = await db.findOne(SystemConstants.TABLE.META, { key });
      return row?.value ?? null;
    });

    const themeManager = new ThemeManager((manager as any).db);
    manager.setThemeArchiveInstaller(async (filePath: string, options?: { activate?: boolean }) => {
      const manifest = await themeManager.installFromZip(filePath);
      if (options?.activate !== false) {
        await themeManager.activateTheme(manifest.slug);
      }
      return manifest;
    });
    manager.setCoreArchiveInstaller(async (filePath: string) => SystemUpdateService.applyArchive(filePath));

    await themeManager.init();

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET is required to start the API server');
    }

    const auth = new AuthManager(jwtSecret);
    manager.setAuth(auth);

    // Seed the platform locale BEFORE plugins register.
    //
    // `server.initialize()` seeds it too, but that runs AFTER `discoverPlugins()` below — so anything a
    // plugin resolves at REGISTRATION time saw the env default instead of the operator's choice. A
    // default-page contract's title is resolved exactly there, so a Bulgarian store had English titles
    // written into its content pages while admin Settings → Localization plainly said `bg`.
    //
    // Runtime reads (an email subject at send time, an invoice at render time) were never affected —
    // they run long after boot — which is why this stayed invisible.
    await ApiBootstrapService.seedPlatformLocale(manager);

    try {
      await manager.discoverPlugins();
      try {
        await themeManager.ensureActiveThemeDependencies();
      } catch (error: any) {
        this.logger.error('Active theme dependency enforcement failed.', error);
      }
    } catch (error: any) {
      this.logger.error('Initial plugin discovery failed. Check manifest files and permissions.', error);
    }

    // Framework owns the /account route tree (built-in AccountShell), independent of any plugin.
    FrameworkAccountPageContractService.register();

    // Framework owns URL redirect rules (_system_redirects, Settings → Redirects) and consults its
    // own store through the same plugin-agnostic registry every other resolver uses.
    SystemRedirectService.register((manager as any).db);

    const server = createServer(manager, themeManager, auth);
    server.pluginRouter.use(pluginApiRouter);

    await server.initialize();
    server.setupPluginCollectionProxy();

    if (process.env.NODE_ENV === 'development') {
      try {
        const hotReload = new HotReloadService(manager, (manager as any).pluginsRoot);
        hotReload.start();
      } catch (error: any) {
        this.logger.warn(`Hot Reload Service failed to start: ${String(error)}`);
      }
    }

    const port = parseInt(process.env.PORT || '3000', 10);
    const host = process.env.HOST || '0.0.0.0';
    server.start(port, host);
  }
}

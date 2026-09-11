import dotenv from 'dotenv';
import express from 'express';
import { AuthManager } from '@fromcode119/auth';
import { AppearanceManager, HotReloadService, LocalizationUtils, Logger, PluginManager, PlatformSettingsService, ServerCoreServices, SystemConstants, SystemRedirectService, SystemUpdateService, ThemeManager, TenantMembershipService } from '@fromcode119/core';
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
    ApiBootstrapService.assertProductionSecret('JWT_SECRET', process.env.JWT_SECRET);
    if (process.env.NODE_ENV === 'production') {
      ApiBootstrapService.assertProductionSecret(
        'INTEGRATION_SECRET_KEY',
        process.env.SECRET_KEY || process.env.INTEGRATION_SECRET_KEY,
      );
    }
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
    // The plugin manager resolves every plugin's `context.theme.*` through this reference, and plugins
    // read it during `discoverPlugins()` below (the forms plugin builds its default contact form from the
    // theme's `contactFormDefaults` in onInit). Without this hand-off `context.theme` was `{}` for every
    // plugin on every boot, and each theme-declared plugin default silently lost to the plugin's own.
    manager.setThemeManager(themeManager);
    manager.setThemeArchiveInstaller(async (filePath: string, options?: { activate?: boolean }) => {
      const manifest = await themeManager.installFromZip(filePath);
      if (options?.activate !== false) {
        await themeManager.activateTheme(manifest.slug);
      }
      return manifest;
    });
    manager.setCoreArchiveInstaller(async (filePath: string) => SystemUpdateService.applyArchive(filePath));
    // A package this installation BUILT arrives as a directory, not an archive. Installing is the
    // same act either way; only getting the files was ever about archives.
    manager.setThemeDirectoryInstaller(async (packageDir: string, options?: { activate?: boolean }) => {
      const manifest = await themeManager.installFromDirectory(packageDir);
      // Activation is opt-IN here, the reverse of the archive path above: a build that installs
      // itself must not change what a live site serves. Pressing Activate is its own decision.
      if (options?.activate === true) {
        await themeManager.activateTheme(manifest.slug);
      }
      return manifest;
    });
    manager.setAppearanceDirectoryInstaller(async (packageDir: string) =>
      new AppearanceManager(new Logger({ namespace: 'appearance' })).installFromDirectory(packageDir));

    await themeManager.init();

    const jwtSecret = process.env.JWT_SECRET as string;

    const auth = new AuthManager(jwtSecret);
    // What an account may do is decided PER SITE: a membership's roles, not the account's global ones.
    // Without this a user who is a customer on one site and an administrator on another was whichever
    // the global roles column said, everywhere.
    auth.useTenantRoles((userId, tenantId) =>
      new TenantMembershipService(manager.db).rolesForTenant(userId, tenantId));
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

  private static assertProductionSecret(name: string, value: string | undefined): void {
    if (!value) throw new Error(`${name} is required to start the API server`);
    if (process.env.NODE_ENV !== 'production') return;

    const normalized = value.trim().toLowerCase();
    if (value.length < 32 || normalized.includes('change_me') || normalized.includes('changeme')) {
      throw new Error(`${name} must be a non-placeholder secret of at least 32 characters in production`);
    }
  }
}

import dotenv from 'dotenv';
import express from 'express';
import { AuthManager } from '@fromcode119/auth';
import {
  HotReloadService,
  Logger,
  PluginManager,
  PlatformSettingsService,
  SystemConstants,
  SystemUpdateService,
  ThemeManager,
} from '@fromcode119/core';
import { FrameworkAccountPageContractService } from '../services/framework-account-page-contract-service';

export class ApiBootstrapService {
  private logger = new Logger({ namespace: 'api-bootstrap-service' });

  async bootstrap(
    createServer: (manager: PluginManager, themeManager: ThemeManager, auth: AuthManager) => any,
  ): Promise<void> {
    dotenv.config();
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

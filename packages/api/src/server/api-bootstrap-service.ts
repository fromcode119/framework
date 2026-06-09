import dotenv from 'dotenv';
import express from 'express';
import { AuthManager } from '@fromcode119/auth';
import {
  HotReloadService,
  Logger,
  PluginManager,
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

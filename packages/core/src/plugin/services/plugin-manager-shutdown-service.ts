import { Logger } from '../../logging';
import { Plugins } from '../../plugins';

/**
 * PluginManagerShutdownService
 *
 * Stop/close sequences for PluginManager. Extracted to keep PluginManager under
 * the size limit; the manager keeps its public shutdown()/close() entry points
 * and delegates here, passing itself in so the same instances are torn down.
 */
export class PluginManagerShutdownService {
  constructor(
    private manager: any,
    private logger: Logger,
  ) {}

  async shutdown(): Promise<void> {
    const manager = this.manager;
    this.logger.info('Shutting down PluginManager services...');

    if (manager.scheduler) {
      await manager.scheduler.stop();
    }

    if (manager.security) {
      manager.security.stop();
    }

    if (manager.jobs) {
      await manager.jobs.close();
    }

    if (manager.webhooks) {
        // Any cleanup for webhooks?
    }

    Plugins.setResolver(null);

    this.logger.info('PluginManager shutdown complete.');
  }

  async close(): Promise<void> {
    const manager = this.manager;
    const activePlugins = manager.getPlugins().filter((plugin: any) => plugin.state === 'active');
    const shutdownOrder = manager.getSortedPlugins(activePlugins).reverse();

    for (const plugin of shutdownOrder) {
      try {
        await manager.disable(plugin.manifest.slug, { persistState: false });
      } catch (err: any) {
        this.logger.warn(`Failed to disable plugin "${plugin.manifest.slug}" during shutdown: ${err?.message || err}`);
      }
    }
    manager.scheduler.stop();
    manager.security.stop();
    await manager.jobs.close();
  }
}

import chokidar from 'chokidar';
import path from 'path';
import { PluginManager } from '../plugin/plugin-manager';
import { Logger } from '../logging';

/**
 * Hot Reload Service
 * Watches the plugins directory for changes and re-registers plugins.
 * Only intended for development environments.
 */
export class HotReloadService {
  private logger = new Logger({ namespace: 'HotReload' });
  private watcher?: chokidar.FSWatcher;

  constructor(private manager: PluginManager, private pluginsDir: string) {}

  start() {
    this.logger.info(`Watching for plugin changes in: ${this.pluginsDir}`);

    this.watcher = chokidar.watch(this.pluginsDir, {
      ignored: /(^|[\/\\])\../, // ignore dotfiles
      persistent: true,
      ignoreInitial: true,
      depth: 5 // plugin-slug/ui/dist/bundle.js (max depth)
    });

    this.watcher.on('change', (filePath) => {
      this.handleFileChange(filePath);
    });

    this.watcher.on('add', (filePath) => {
      this.handleFileChange(filePath);
    });
  }

  stop() {
    if (this.watcher) {
      this.watcher.close();
    }
  }

  private async handleFileChange(filePath: string) {
    // Detect which plugin changed
    const relative = path.relative(this.pluginsDir, filePath);
    const parts = relative.split(path.sep);
    
    if (parts.length > 0) {
      const pluginSlug = parts[0];
      this.logger.info(`Detected change in plugin "${pluginSlug}". Triggering reload...`);
      
      try {
        // In a real system we would need to uncache modules
        // For this implementation we'll just log the intent and let the HMR of the host handle the rest
        // or trigger a manager re-registration if possible.
        
        // 1. Emit internal hook for other services
        this.manager.emit(`plugin:${pluginSlug}:reload_required`, { path: filePath });

        // 2. Emit global HMR event for the API (SSE)
        const isUIBundle = filePath.endsWith('bundle.js');
        this.manager.emit('system:hmr:reload', {
          type: isUIBundle ? 'plugin:ui:reload' : 'plugin:reload',
          slug: pluginSlug,
          path: relative,
          timestamp: Date.now()
        });
      } catch (err) {
        this.logger.error(`Failed to hot-reload plugin "${pluginSlug}": ${err}`);
      }
    }
  }
}
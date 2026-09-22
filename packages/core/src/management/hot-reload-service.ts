import chokidar from 'chokidar';
import path from 'path';
import { PluginManager } from '@core/plugin/plugin-manager';
import { Logger } from '@core/logging';

/**
 * Watches the plugins directory and announces what changed.
 *
 * READ THIS BEFORE TRUSTING THE NAME. It does **not** re-register a plugin into this process. It
 * cannot: the api holds each plugin's manifest and collection schema in memory from boot, and
 * `PluginEntityRegistrationService.mergeCollectionFields` only ADDS fields that are not already
 * registered — it never updates one — because several plugins legitimately extend the same
 * collection. Re-running a plugin's registration would therefore keep every old field definition.
 *
 * What it used to do was worse than nothing: it logged `Triggering reload...` and then, by its own
 * comment, "just log the intent". An operator reading that line would believe the new code was
 * live. On production a plugin ran a full release behind for over an hour while every version
 * signal — the registry row, the manifest, the release tag — read correct.
 *
 * So it says what actually happened instead. A UI bundle change IS served from disk on the next
 * request, so that reload is real. A backend or manifest change is not applied until the process
 * restarts, and `PluginHealthReportService` reports it as `restartPending` from the same evidence
 * this service sees.
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
    
    if (parts.length === 0) return;

    const pluginSlug = parts[0];
    // The browser re-fetches a UI bundle from disk, so that one really is live. Anything else is
    // code this process already loaded and will keep running until it restarts.
    const isUIBundle = filePath.endsWith('bundle.js');

    if (isUIBundle) {
      this.logger.info(`Plugin "${pluginSlug}" UI bundle changed; reload the admin to pick it up.`);
    } else {
      this.logger.info(
        `Plugin "${pluginSlug}" changed on disk (${relative}). The running process keeps serving the ` +
        `version it loaded at boot — this is reported as a pending restart on the plugin health screen.`,
      );
    }

    try {
      // Kept for anything listening; neither event re-registers the plugin, and no subscriber should
      // be written on the assumption that one does.
      this.manager.emit(`plugin:${pluginSlug}:reload_required`, { path: filePath });
      this.manager.emit('system:hmr:reload', {
        type: isUIBundle ? 'plugin:ui:reload' : 'plugin:reload',
        slug: pluginSlug,
        path: relative,
        timestamp: Date.now()
      });
    } catch (err) {
      this.logger.error(`Failed to announce the change in plugin "${pluginSlug}": ${err}`);
    }
  }
}
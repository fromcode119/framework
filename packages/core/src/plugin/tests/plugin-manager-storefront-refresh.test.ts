import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { PluginManager } from '@core/plugin/plugin-manager';
import { StorefrontRendererRefreshService } from '@core/management/storefront-renderer-refresh-service';
import { ExtensionScope } from '@core/plugin/enums/extension-scope.enum';

/**
 * The storefront renders from each plugin's `ui-ssr` bundle and holds it for the life of its process,
 * so a plugin whose files just changed keeps rendering from the previous copy — silently, as EMPTY
 * plugin- and translation-derived values rather than an error. On the live site that read as product
 * prices and labels disappearing from the server-rendered HTML right after an update, with nothing
 * anywhere saying why. Every path that replaces plugin files on disk therefore has to refresh the
 * renderer; these tests pin that to the manager so a new install path cannot quietly skip it.
 */
describe('PluginManager storefront renderer refresh', () => {
  let refresh: ReturnType<typeof vi.spyOn>;

  /** The manager without its constructor: these tests are about delegation, not about booting a manager. */
  function managerWith(installation: Record<string, unknown>, archiveInstaller: Record<string, unknown> = {}): any {
    const manager = Object.create(PluginManager.prototype);
    manager.installation = installation;
    manager.archiveInstaller = archiveInstaller;
    manager.logger = { info: () => {}, warn: () => {}, error: () => {} };
    return manager;
  }

  beforeEach(() => {
    refresh = vi.spyOn(StorefrontRendererRefreshService, 'afterExtensionsChanged').mockResolvedValue(undefined);
  });

  afterEach(() => {
    refresh.mockRestore();
  });

  it('refreshes after a marketplace install/update', async () => {
    const manager = managerWith({ installOrUpdateFromMarketplace: async () => ({ slug: 'ecommerce' }) });

    const manifest = await manager.installOrUpdateFromMarketplace('ecommerce');

    expect(manifest).toEqual({ slug: 'ecommerce' });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('refreshes after an uploaded plugin archive', async () => {
    const manager = managerWith({ installUploadedPluginArchive: async () => ({ slug: 'seo' }) });

    await manager.installUploadedPluginArchive('/tmp/seo.tar.gz');

    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('refreshes ONCE for a whole batch update, not once per plugin', async () => {
    const manager = managerWith({
      updateAllFromMarketplace: async () => ({ updated: ['ecommerce', 'cms', 'seo'], failed: [] }),
    });

    await manager.updateAllFromMarketplace();

    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('does NOT refresh when a batch update changed nothing on disk', async () => {
    const manager = managerWith({ updateAllFromMarketplace: async () => ({ updated: [], failed: [] }) });

    await manager.updateAllFromMarketplace();

    expect(refresh).not.toHaveBeenCalled();
  });

  it('refreshes for a PLUGIN extension archive', async () => {
    const manager = managerWith({}, { installExtensionArchive: async () => ({ slug: 'forms' }) });

    await manager.installExtensionArchive('/tmp/forms.tar.gz', ExtensionScope.PLUGIN);

    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('leaves a THEME extension archive to the theme manager, so the storefront restarts once', async () => {
    const manager = managerWith({}, { installExtensionArchive: async () => ({ slug: 'atlantis' }) });

    await manager.installExtensionArchive('/tmp/atlantis.tar.gz', ExtensionScope.THEME);

    expect(refresh).not.toHaveBeenCalled();
  });
});

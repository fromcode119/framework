import { ThemeMode } from '@fromcode119/core/client';
import { NotificationType } from '@/components/enums/notification-type.enum';
import type { MouseEvent, ReactElement } from 'react';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import type { IPluginEntry } from '@fromcode119/core/client';
import { PluginInstallOperationService } from '@/lib/plugin-install-operation-service';
import { PluginVersionWaitService } from '@/lib/plugin-version-wait-service';
import { VersionComparisonService } from '@fromcode119/core/client';
import { AdminComponent } from '@/components/view/admin-component.client';
import { MarketplaceSearchBar } from '@/app/plugins/marketplace/components/view/marketplace-search-bar.client';
import { MarketplacePluginCard } from '@/app/plugins/marketplace/components/view/marketplace-plugin-card.client';
import { MarketplaceLoadingGrid } from '@/app/plugins/marketplace/components/view/marketplace-loading-grid.client';
import { MarketplaceEmptyState } from '@/app/plugins/marketplace/components/view/marketplace-empty-state.client';
import { state } from '@fromcode119/reactor';

export class MarketplacePage extends AdminComponent {
  private mounted = false;
  private prevRefreshVersion: any = undefined;

  @state plugins: IPluginEntry[] = [];
  @state installedPlugins: any[] = [];
  @state loading = true;
  @state installing: string | null = null;
  @state updatingAll = false;
  @state updateAllProgress = '';
  @state searchQuery = '';
  @state imageErrors: Record<string, boolean> = {};

  componentDidMount(): void {
    this.mounted = true;
    void this.fetchData();
  }

  componentDidUpdate(): void {
    if (this.runtime.plugins?.refreshVersion !== this.prevRefreshVersion) {
      void this.fetchData();
    }
  }

  componentWillUnmount(): void {
    this.mounted = false;
  }

  private async fetchData(refresh = false): Promise<void> {
    this.prevRefreshVersion = this.runtime.plugins?.refreshVersion;
    this.loading = true;
    try {
      const listUrl = refresh
        ? `${AdminConstants.ENDPOINTS.PLUGINS.LIST}?refresh=true`
        : AdminConstants.ENDPOINTS.PLUGINS.LIST;
      // A refresh must SEE the post-update state — the short-lived GET response cache would happily
      // repaint the pre-update versions and make a finished update look like it did nothing.
      const [marketData, instData] = await Promise.all([
        AdminApi.get(AdminConstants.ENDPOINTS.PLUGINS.MARKETPLACE, refresh ? { noDedupe: true } : undefined),
        AdminApi.get(listUrl, refresh ? { noDedupe: true } : undefined)
      ]);
      const rawPlugins = marketData.plugins || [];

      // Group by slug to show only latest
      const grouped: Record<string, IPluginEntry> = {};
      rawPlugins.forEach((p: IPluginEntry) => {
        if (!grouped[p.slug] || VersionComparisonService.isGreater(p.version, grouped[p.slug].version)) {
          grouped[p.slug] = p;
        }
      });

      if (!this.mounted) return;
      this.plugins = Object.values(grouped);
      this.installedPlugins = Array.isArray(instData) ? instData : [];
    } catch (err) {
      console.error("Failed to fetch marketplace data", err);
    } finally {
      if (this.mounted) this.loading = false;
    }
  }

  private async handleInstall(e: MouseEvent, slug: string, targetVersion: string): Promise<void> {
    e.stopPropagation();
    if (this.installing) return;

    const notify = this.runtime.notify.notify;
    const triggerRefresh = this.runtime.plugins?.triggerRefresh;
    const isUpdate = Boolean(this.installedPlugins.find((p) => (p.manifest?.slug || p.slug) === slug));

    try {
      this.installing = slug;
      notify(NotificationType.INFO, isUpdate ? 'Updating Plugin' : 'Installing Plugin', `${isUpdate ? 'Updating' : 'Downloading and staging'} ${slug} v${targetVersion}...`);

      const { operationId } = await PluginInstallOperationService.startMarketplaceInstall(slug, targetVersion);
      // Wait for the background operation to fully complete (handles restart recovery internally)
      await PluginInstallOperationService.waitForCompletion(operationId);
      await PluginVersionWaitService.waitForInstalledVersion(slug, targetVersion);

      if (triggerRefresh) {
        await Promise.resolve(triggerRefresh());
      }
      await this.fetchData(true);
      notify(NotificationType.SUCCESS, isUpdate ? 'Update Complete' : 'Installation Complete', `Plugin "${slug}" v${targetVersion} was ${isUpdate ? 'updated' : 'installed'} successfully.`);
    } catch (err: any) {
      console.error('[Marketplace] Installation failed:', err);
      notify(NotificationType.ERROR, isUpdate ? 'Update Failed' : 'Installation Failed', err.message || `Failed to ${isUpdate ? 'update' : 'install'} plugin`);
    } finally {
      this.installing = null;
    }
  }

  /**
   * Every plugin with an available update, in ONE server-side batch — the API replaces them all and
   * restarts ONCE at the end, instead of the restart-per-plugin cost of clicking each card.
   */
  private async handleUpdateAll(updateCount: number): Promise<void> {
    if (this.updatingAll || this.installing) return;
    const notify = this.runtime.notify.notify;
    const triggerRefresh = this.runtime.plugins?.triggerRefresh;
    try {
      this.updatingAll = true;
      this.updateAllProgress = `Starting ${updateCount} update${updateCount === 1 ? '' : 's'}...`;
      const response = await AdminApi.post(AdminConstants.ENDPOINTS.PLUGINS.UPDATE_ALL);
      if (!response?.operationId) throw new Error(response?.error || 'The batch update could not be started.');
      // The server leads each message with the remaining count ("6 updates remaining — ...") and
      // ends with "restarting the API" — shown verbatim so the operator watches it count down.
      await PluginInstallOperationService.waitForCompletion(response.operationId, (operation) => {
        if (this.mounted && operation?.message) this.updateAllProgress = operation.message;
      });
      this.updateAllProgress = 'API is back — refreshing the catalog...';
      if (triggerRefresh) await Promise.resolve(triggerRefresh());
      await this.refetchUntilSettled();
      notify(NotificationType.SUCCESS, 'Plugins Updated', 'Every available update is installed and the API is back up.');
    } catch (err: any) {
      console.error('[Marketplace] Batch update failed:', err);
      notify(NotificationType.ERROR, 'Update All Failed', err.message || 'The batch update did not complete.');
    } finally {
      this.updatingAll = false;
      this.updateAllProgress = '';
    }
  }

  /**
   * Right after the restart the api may answer /health before the plugin registry has finished
   * re-registering, so one immediate refetch can still show the OLD versions — which is exactly the
   * "it updated but the page still offers updates" bug. Refetch (cache-bypassed) until the computed
   * update count reaches zero, bounded so a genuinely-failed update still surfaces.
   */
  private async refetchUntilSettled(): Promise<void> {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await this.fetchData(true);
      const settled = !this.plugins.some((p) => {
        const inst = this.installedPlugins.find((i) => (i.manifest?.slug || i.slug) === p.slug);
        return inst && VersionComparisonService.isGreater(p.version, inst.manifest?.version || inst.version);
      });
      if (settled || !this.mounted) return;
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  private get filtered(): IPluginEntry[] {
    const { plugins, searchQuery } = this;
    return plugins.filter(p =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }

  render(): ReactElement {
    const theme = this.theme;
    const { loading, installing, searchQuery, installedPlugins, imageErrors } = this;
    const filtered = this.filtered;

    const installedCount = filtered.filter((p) => installedPlugins.find((i) => (i.manifest?.slug || i.slug) === p.slug)).length;
    const updateCount = filtered.filter((p) => {
      const inst = installedPlugins.find((i) => (i.manifest?.slug || i.slug) === p.slug);
      return inst && VersionComparisonService.isGreater(p.version, inst.manifest?.version || inst.version);
    }).length;
    const isDark = theme === ThemeMode.DARK;
    const summary: Array<{ label: string; value: number; tone: string }> = [
      { label: 'Available', value: filtered.length, tone: isDark ? 'text-white' : 'text-slate-900' },
      { label: 'Installed', value: installedCount, tone: 'text-emerald-500' },
      { label: 'Updates', value: updateCount, tone: 'text-amber-500' },
    ];

    return (
      <div className="space-y-4 animate-in fade-in duration-500">
        <MarketplaceSearchBar
          theme={theme}
          searchQuery={searchQuery}
          onChange={(value) => { this.searchQuery = value; }}
        />

        {!loading && filtered.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            {summary.map((s) => (
              <div key={s.label} className={`flex items-baseline gap-1.5 rounded-lg border px-3 py-1.5 ${isDark ? 'border-white/10 bg-slate-900/40' : 'border-slate-200 bg-white shadow-sm'}`}>
                <span className={`text-sm font-bold tabular-nums ${s.tone}`}>{s.value}</span>
                <span className={`text-[10px] font-semibold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{s.label}</span>
              </div>
            ))}
            {this.updatingAll ? (
              /* The button is GONE while the batch runs — in its place, the server's own progress
                 messages counting down to the restart. */
              <div className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[11px] font-semibold ${isDark ? 'border-amber-500/30 bg-amber-500/10 text-amber-300' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
                <span className="h-3 w-3 shrink-0 rounded-full border-2 border-current border-t-transparent animate-spin" />
                <span className="normal-case tracking-normal">{this.updateAllProgress || 'Updating plugins...'}</span>
              </div>
            ) : updateCount > 0 ? (
              <button
                type="button"
                disabled={!!installing}
                onClick={() => this.handleUpdateAll(updateCount)}
                className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-white transition-all shadow-sm active:scale-[0.97] bg-amber-600 hover:bg-amber-700"
              >
                Update All ({updateCount})
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 items-start">
          {loading ? (
            <MarketplaceLoadingGrid theme={theme} />
          ) : filtered.length === 0 ? (
            <MarketplaceEmptyState theme={theme} />
          ) : (
            filtered.map(plugin => {
              const installed = installedPlugins.find(p => (p.manifest?.slug || p.slug) === plugin.slug);
              const installedVersion = installed ? (installed.manifest?.version || installed.version) : null;
              const hasUpdate = Boolean(installed && VersionComparisonService.isGreater(plugin.version, installedVersion));

              return (
                <MarketplacePluginCard
                  key={plugin.slug}
                  plugin={plugin}
                  theme={theme}
                  installed={installed}
                  installedVersion={installedVersion}
                  hasUpdate={hasUpdate}
                  hasImageError={imageErrors[plugin.slug]}
                  installing={installing}
                  onOpenDetail={() => this.router.push(AdminConstants.ROUTES.PLUGINS.MARKETPLACE_DETAIL(plugin.slug))}
                  onOpenInstalled={(e) => { e.stopPropagation(); this.router.push(AdminConstants.ROUTES.PLUGINS.DETAIL(plugin.slug)); }}
                  onInstall={(e) => this.handleInstall(e, plugin.slug, plugin.version)}
                  onImageError={() => { this.imageErrors = { ...this.imageErrors, [plugin.slug]: true }; }}
                />
              );
            })
          )}
        </div>
      </div>
    );
  }
}

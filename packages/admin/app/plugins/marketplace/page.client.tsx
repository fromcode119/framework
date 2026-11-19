import { ThemeMode } from '@fromcode119/core/client';
import { NotificationType } from '@/components/enums/notification-type.enum';
import type { MouseEvent, ReactElement } from 'react';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import type { IPluginEntry } from '@fromcode119/core/client';
import { PluginInstallOperationService } from '@/lib/plugin-install-operation-service';
import { PluginBatchUpdateWaitService } from '@/lib/plugin-batch-update-wait-service';
import type { IPluginBatchSettleHost } from '@/lib/interfaces/plugin-batch-settle-host.interface';
import { PluginVersionWaitService } from '@/lib/plugin-version-wait-service';
import { VersionComparisonService } from '@fromcode119/core/client';
import { PlatformOnlyPanel } from '@/components/view/platform-only-panel.client';
import { PlatformAccess } from '@/lib/tenants/platform-access';
import { AdminComponent } from '@/components/view/admin-component.client';
import { PageBar } from '@/components/ui/view/page-bar.client';
import { Tabs } from '@/components/ui/view/tabs.client';
import { SearchField } from '@/components/ui/view/search-field.client';
import { ListCard } from '@/components/ui/view/list-card.client';
import { ProgressBar } from '@/components/ui/view/progress-bar.client';
import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { MarketplacePluginCard } from '@/app/plugins/marketplace/components/view/marketplace-plugin-card.client';
import { MarketplaceLoadingGrid } from '@/app/plugins/marketplace/components/view/marketplace-loading-grid.client';
import { MarketplaceEmptyState } from '@/app/plugins/marketplace/components/view/marketplace-empty-state.client';
import { state } from '@fromcode119/react-class-components';
import { PlatformScopeGate } from '@/components/view/platform-scope-gate.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { PluginConsentHost } from '@/components/plugins/view/plugin-consent-host.client';
import { MarketplacePluginCopy } from '@/app/plugins/marketplace/marketplace-plugin-copy';

export class MarketplacePage extends AdminComponent implements IPluginBatchSettleHost {
  private mounted = false;
  private prevRefreshVersion: any = undefined;

  @state plugins: IPluginEntry[] = [];
  @state installedPlugins: any[] = [];
  @state loading = true;
  /** The catalogue address the api read, or null when no marketplace is set for this scope. */
  @state catalogSource: string | null = null;
  @state installing: string | null = null;
  @state updatingAll = false;
  @state updateAllProgress = '';
  @state searchQuery = '';
  /** Which part of the catalogue is listed: all of it, what is installed, or what has an update. */
  @state part = 'all';
  @state imageErrors: Record<string, boolean> = {};
  @state consentSlugs: string[] = [];

  /** Installing code onto the shared container is the platform's act, never a site's. */
  private get canManagePlatform(): boolean {
    return PlatformAccess.canManagePlatform(this.auth.user);
  }

  componentDidMount(): void {
    this.mounted = true;
    if (!this.canManagePlatform) {
      this.loading = false;
      return;
    }
    void this.fetchData();
  }

  componentDidUpdate(): void {
    if (!this.canManagePlatform) return;
    // During a batch update the settle loop owns all fetching — reacting to the refreshVersion bump
    // here would flip the grid into loading skeletons (and hit a restarting api) mid-batch.
    if (this.updatingAll) return;
    if (this.runtime.plugins?.refreshVersion !== this.prevRefreshVersion) {
      void this.fetchData();
    }
  }

  componentWillUnmount(): void {
    this.mounted = false;
  }

  private async fetchData(refresh = false, background = false): Promise<void> {
    this.prevRefreshVersion = this.runtime.plugins?.refreshVersion;
    if (!background) this.loading = true;
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
      this.catalogSource = marketData.source ?? null;
      this.installedPlugins = Array.isArray(instData) ? instData : [];
    } catch (err) {
      // A background refetch runs while the api may be mid-restart — the settle loop needs to SEE
      // the failure (it is progress, not an error), so rethrow instead of spamming the console.
      if (background) throw err;
      console.error("Failed to fetch marketplace data", err);
    } finally {
      if (!background && this.mounted) this.loading = false;
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
      notify(NotificationType.INFO, isUpdate ? AdminI18n.t('plugins.list.updatingPlugin') : AdminI18n.t('plugins.list.installingPlugin'), AdminI18n.t(isUpdate ? 'plugins.list.updatingVersion' : 'plugins.list.stagingVersion', { slug, version: targetVersion }));

      const { operationId } = await PluginInstallOperationService.startMarketplaceInstall(slug, targetVersion);
      // Wait for the background operation to fully complete (handles restart recovery internally)
      await PluginInstallOperationService.waitForCompletion(operationId);
      await PluginVersionWaitService.waitForInstalledVersion(slug, targetVersion);

      if (triggerRefresh) {
        await Promise.resolve(triggerRefresh());
      }
      await this.fetchData(true);
      notify(NotificationType.SUCCESS, isUpdate ? AdminI18n.t('plugins.list.updateComplete') : AdminI18n.t('plugins.list.installationComplete'), AdminI18n.t(isUpdate ? 'plugins.list.wasUpdated' : 'plugins.list.wasInstalled', { slug, targetVersion }));
      this.consentSlugs = [slug]; // whatever it asks for that nobody approved yet waits for this dialog
    } catch (err: any) {
      console.error('[Marketplace] Installation failed:', err);
      notify(NotificationType.ERROR, isUpdate ? AdminI18n.t('plugins.list.updateFailed') : AdminI18n.t('plugins.list.installationFailed'), err.message || AdminI18n.t(isUpdate ? 'plugins.list.failedToUpdate' : 'plugins.list.failedToInstall'));
    } finally {
      this.installing = null;
    }
  }

  /**
   * Every plugin with an available update, in ONE server-side batch — the API replaces them all and
   * restarts ONCE at the end, instead of the restart-per-plugin cost of clicking each card.
   *
   * The operation reports 'completed' BEFORE the scheduled restart actually fires, so "completed"
   * here means "the batch landed on disk", NOT "the api survived the restart" — the settle wait
   * below rides through the downtime and is the only thing allowed to declare success.
   */
  private async handleUpdateAll(updateCount: number): Promise<void> {
    if (this.updatingAll || this.installing) return;
    const notify = this.runtime.notify.notify;
    const triggerRefresh = this.runtime.plugins?.triggerRefresh;
    try {
      this.updatingAll = true;
      this.updateAllProgress = AdminI18n.t('plugins.list.startingUpdates', { count: updateCount });
      const response = await AdminApi.post(AdminConstants.ENDPOINTS.PLUGINS.UPDATE_ALL);
      if (!response?.operationId) throw new Error(response?.error || AdminI18n.t('plugins.list.batchNotStarted'));
      // The server leads each message with the remaining count ("6 updates remaining — ...") and
      // ends with "restarting the API" — shown verbatim so the operator watches it count down.
      await PluginInstallOperationService.waitForCompletion(response.operationId, (operation) => {
        if (this.mounted && operation?.message) this.updateAllProgress = operation.message;
      });
      const settled = await PluginBatchUpdateWaitService.waitUntilSettled(this);
      if (triggerRefresh) await Promise.resolve(triggerRefresh());
      if (settled) {
        notify(NotificationType.SUCCESS, AdminI18n.t('plugins.list.pluginsUpdated'), AdminI18n.t('plugins.list.everyAvailableUpdateIsInstalled'));
      } else if (this.mounted) {
        notify(NotificationType.ERROR, AdminI18n.t('plugins.list.updateNotConfirmed'), AdminI18n.t('plugins.list.theUpdatesWereAppliedBut'));
      }
    } catch (err: any) {
      console.error('[Marketplace] Batch update failed:', err);
      notify(NotificationType.ERROR, AdminI18n.t('plugins.list.updateAllFailed'), err.message || AdminI18n.t('plugins.list.theBatchUpdateDidNot'));
    } finally {
      this.updatingAll = false;
      this.updateAllProgress = '';
    }
  }

  async refetchCatalogInBackground(): Promise<void> {
    return this.fetchData(true, true);
  }

  isCatalogSettled(): boolean {
    return !this.plugins.some((p) => this.hasPendingUpdateFor(p));
  }

  isStillMounted(): boolean {
    return this.mounted;
  }

  reportSettleProgress(message: string): void {
    if (this.mounted) this.updateAllProgress = message;
  }

  private hasPendingUpdateFor(plugin: IPluginEntry): boolean {
    const inst = this.installedPlugins.find((i) => (i.manifest?.slug || i.slug) === plugin.slug);
    return Boolean(inst && VersionComparisonService.isGreater(plugin.version, inst.manifest?.version || inst.version));
  }

  private get filtered(): IPluginEntry[] {
    const { plugins, searchQuery } = this;
    return plugins.filter((p) => MarketplacePluginCopy.matches(p, this.installedPlugins.find((i) => (i.manifest?.slug || i.slug) === p.slug), searchQuery));
  }

  render(): ReactElement {
    return <PlatformScopeGate what={AdminI18n.t('plugins.list.theMarketplace')}>{this.renderMarketplace()}</PlatformScopeGate>;
  }

  private renderMarketplace(): ReactElement {
    if (!this.canManagePlatform) {
      return (
        <PlatformOnlyPanel detail={AdminI18n.t('plugins.list.theMarketplaceInstallsPluginsAnd')} />
      );
    }

    const theme = this.theme;
    const { loading, installing, searchQuery, installedPlugins, imageErrors } = this;
    const all = this.filtered;
    const isInstalled = (p: IPluginEntry): boolean => Boolean(installedPlugins.find((i) => (i.manifest?.slug || i.slug) === p.slug));
    const installedCount = all.filter(isInstalled).length;
    const updateCount = all.filter((p) => this.hasPendingUpdateFor(p)).length;
    const shown = this.part === 'installed' ? all.filter(isInstalled) : this.part === 'updates' ? all.filter((p) => this.hasPendingUpdateFor(p)) : all;

    return (
      <div className="fc-columns__stack">
        <PluginConsentHost slugs={this.consentSlugs} onApproved={() => undefined} onFinished={() => { this.consentSlugs = []; void this.fetchData(true); }} />
        <PageBar lead={(
          <Tabs label={AdminI18n.t('plugins.list.theMarketplace')} value={this.part} onChange={(id: string) => { this.part = id; }}
            tabs={[
              { id: 'all', label: AdminI18n.t('plugins.list.available'), count: all.length },
              { id: 'installed', label: AdminI18n.t('plugins.list.installed'), count: installedCount },
              { id: 'updates', label: AdminI18n.t('plugins.list.updates'), count: updateCount },
            ]} />
        )}>
          <SearchField value={searchQuery} onChange={(value: string) => { this.searchQuery = value; }} placeholder={AdminI18n.t('plugins.list.searchGlobalMarketplace')} />
          {!this.updatingAll && updateCount > 0 ? (
            <Button variant={ButtonVariant.PRIMARY} disabled={Boolean(installing)} onClick={() => this.handleUpdateAll(updateCount)}>{AdminI18n.t('plugins.list.updateAll', { count: updateCount })}</Button>
          ) : null}
        </PageBar>

        {/* While the batch runs the button is gone — in its place, the server's own progress messages
            counting down to the restart. */}
        {this.updatingAll ? <ProgressBar label={this.updateAllProgress || AdminI18n.t('plugins.list.updatingPlugins')} /> : null}

        {loading ? (
          <ListCard><MarketplaceLoadingGrid theme={theme} /></ListCard>
        ) : shown.length === 0 ? (
          <MarketplaceEmptyState configured={Boolean(this.catalogSource) || Boolean(this.searchQuery) || all.length > 0} />
        ) : (
          <ListCard>
            {shown.map((plugin) => {
              const installed = installedPlugins.find((p) => (p.manifest?.slug || p.slug) === plugin.slug);
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
                  canInstall={this.canManagePlatform}
                  onOpenDetail={() => this.router.push(AdminConstants.ROUTES.PLUGINS.MARKETPLACE_DETAIL(plugin.slug))}
                  onOpenInstalled={(e) => { e.stopPropagation(); this.router.push(AdminConstants.ROUTES.PLUGINS.DETAIL(plugin.slug)); }}
                  onInstall={(e) => this.handleInstall(e, plugin.slug, plugin.version)}
                  onImageError={() => { this.imageErrors = { ...this.imageErrors, [plugin.slug]: true }; }}
                />
              );
            })}
          </ListCard>
        )}
      </div>
    );
  }
}

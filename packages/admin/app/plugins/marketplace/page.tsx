"use client";

import React from 'react';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants';
import type { PluginEntry } from '@fromcode119/core/client';
import { PluginInstallOperationService } from '@/lib/plugin-install-operation-service';
import { PluginVersionWaitService } from '@/lib/plugin-version-wait-service';
import { VersionComparisonService } from '@/lib/version-comparison-service';
import { AdminComponent } from '@/components/admin-component';
import { MarketplaceSearchBar } from './marketplace-search-bar';
import { MarketplacePluginCard } from './marketplace-plugin-card';
import { MarketplaceLoadingGrid } from './marketplace-loading-grid';
import { MarketplaceEmptyState } from './marketplace-empty-state';
import type { MarketplacePageState } from './marketplace-page.interfaces';

export default class MarketplacePage extends AdminComponent<Record<string, never>, MarketplacePageState> {
  private mounted = false;
  private prevRefreshVersion: any = undefined;

  state: MarketplacePageState = {
    plugins: [],
    installedPlugins: [],
    loading: true,
    installing: null,
    searchQuery: '',
    imageErrors: {},
  };

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
    this.setState({ loading: true });
    try {
      const listUrl = refresh
        ? `${AdminConstants.ENDPOINTS.PLUGINS.LIST}?refresh=true`
        : AdminConstants.ENDPOINTS.PLUGINS.LIST;
      const [marketData, instData] = await Promise.all([
        AdminApi.get(AdminConstants.ENDPOINTS.PLUGINS.MARKETPLACE),
        AdminApi.get(listUrl)
      ]);
      const rawPlugins = marketData.plugins || [];

      // Group by slug to show only latest
      const grouped: Record<string, PluginEntry> = {};
      rawPlugins.forEach((p: PluginEntry) => {
        if (!grouped[p.slug] || VersionComparisonService.isGreater(p.version, grouped[p.slug].version)) {
          grouped[p.slug] = p;
        }
      });

      if (!this.mounted) return;
      this.setState({
        plugins: Object.values(grouped),
        installedPlugins: Array.isArray(instData) ? instData : [],
      });
    } catch (err) {
      console.error("Failed to fetch marketplace data", err);
    } finally {
      if (this.mounted) this.setState({ loading: false });
    }
  }

  private async handleInstall(e: React.MouseEvent, slug: string, targetVersion: string): Promise<void> {
    e.stopPropagation();
    if (this.state.installing) return;

    const notify = this.runtime.notify.notify;
    const triggerRefresh = this.runtime.plugins?.triggerRefresh;
    const isUpdate = Boolean(this.state.installedPlugins.find((p) => (p.manifest?.slug || p.slug) === slug));

    try {
      this.setState({ installing: slug });
      notify('info', isUpdate ? 'Updating Plugin' : 'Installing Plugin', `${isUpdate ? 'Updating' : 'Downloading and staging'} ${slug} v${targetVersion}...`);

      const { operationId } = await PluginInstallOperationService.startMarketplaceInstall(slug, targetVersion);
      // Wait for the background operation to fully complete (handles restart recovery internally)
      await PluginInstallOperationService.waitForCompletion(operationId);
      await PluginVersionWaitService.waitForInstalledVersion(slug, targetVersion);

      if (triggerRefresh) {
        await Promise.resolve(triggerRefresh());
      }
      await this.fetchData(true);
      notify('success', isUpdate ? 'Update Complete' : 'Installation Complete', `Plugin "${slug}" v${targetVersion} was ${isUpdate ? 'updated' : 'installed'} successfully.`);
    } catch (err: any) {
      console.error('[Marketplace] Installation failed:', err);
      notify('error', isUpdate ? 'Update Failed' : 'Installation Failed', err.message || `Failed to ${isUpdate ? 'update' : 'install'} plugin`);
    } finally {
      this.setState({ installing: null });
    }
  }

  private get filtered(): PluginEntry[] {
    const { plugins, searchQuery } = this.state;
    return plugins.filter(p =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }

  render(): React.ReactElement {
    const theme = this.theme;
    const { loading, installing, searchQuery, installedPlugins, imageErrors } = this.state;
    const filtered = this.filtered;

    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
        <MarketplaceSearchBar
          theme={theme}
          searchQuery={searchQuery}
          onChange={(value) => this.setState({ searchQuery: value })}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
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
                  onImageError={() => this.setState(prev => ({ imageErrors: { ...prev.imageErrors, [plugin.slug]: true } }))}
                />
              );
            })
          )}
        </div>
      </div>
    );
  }
}

"use client";

import React from 'react';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants';
import { FrameworkIcons } from '@fromcode119/react';
import type { PluginInstallOperation } from '@/lib/plugin-install-operation.interfaces';
import { Lightbox } from '@/components/ui/lightbox';
import { PluginInstallOperationService } from '@/lib/plugin-install-operation-service';
import { PluginVersionWaitService } from '@/lib/plugin-version-wait-service';
import { VersionComparisonService } from '@/lib/version-comparison-service';
import { AdminComponent } from '@/components/admin-component';
import { MarketplaceDetailLoading } from './marketplace-detail-loading';
import { MarketplaceDetailError } from './marketplace-detail-error';
import { MarketplaceDetailHeader } from './marketplace-detail-header';
import { MarketplaceScreenshots } from './marketplace-screenshots';
import { MarketplaceChangelog } from './marketplace-changelog';
import { MarketplaceDetailSidebar } from './marketplace-detail-sidebar';
import type {
  MarketplaceDetailPageProps,
  MarketplaceDetailPageState,
} from './marketplace-detail-page.interfaces';

export default class MarketplaceDetailPage extends AdminComponent<MarketplaceDetailPageProps, MarketplaceDetailPageState> {
  private mounted = false;
  private prevSelectedVersion = '';

  state: MarketplaceDetailPageState = {
    routeSlug: '',
    resolved: false,
    plugin: null,
    allVersions: [],
    selectedVersion: '',
    installedPlugin: null,
    loading: true,
    error: null,
    installing: false,
    installOperation: null,
    activeImageIndex: 0,
    showLightbox: false,
  };

  async componentDidMount(): Promise<void> {
    this.mounted = true;
    const params = await this.props.params;
    if (!this.mounted) return;
    this.prevSelectedVersion = this.state.selectedVersion;
    this.setState({ routeSlug: params.slug, resolved: true }, () => void this.fetchData());
  }

  componentDidUpdate(): void {
    if (this.state.resolved && this.state.selectedVersion !== this.prevSelectedVersion) {
      this.prevSelectedVersion = this.state.selectedVersion;
      void this.fetchData();
    }
  }

  componentWillUnmount(): void {
    this.mounted = false;
  }

  private async fetchData(): Promise<void> {
    const { routeSlug: slug, selectedVersion } = this.state;
    this.setState({ loading: true, error: null });
    try {
      const [marketData, instData] = await Promise.all([
        AdminApi.get(AdminConstants.ENDPOINTS.PLUGINS.MARKETPLACE),
        AdminApi.get(AdminConstants.ENDPOINTS.PLUGINS.LIST)
      ]);

      const versions = (marketData.plugins || []).filter((p: any) => p.slug === slug);
      if (versions.length === 0) {
        if (this.mounted) this.setState({ error: 'Plugin not found in marketplace.' });
      } else {
        // Sort descending
        versions.sort((a: any, b: any) => VersionComparisonService.isGreater(a.version, b.version) ? -1 : (VersionComparisonService.isSame(a.version, b.version) ? 0 : 1));

        const current = selectedVersion ? (versions.find((v: any) => v.version === selectedVersion) || versions[0]) : versions[0];
        if (!this.mounted) return;
        this.setState({
          allVersions: versions,
          plugin: current,
          // Reset active image when plugin changes
          activeImageIndex: 0,
          installedPlugin: (instData || []).find((p: any) => (p.manifest?.slug || p.slug) === slug),
        });
        if (!selectedVersion) {
          this.prevSelectedVersion = current.version;
          this.setState({ selectedVersion: current.version });
        }
      }
    } catch (err) {
      console.error('Failed to load plugin details', err);
      if (this.mounted) this.setState({ error: 'Failed to connect to the marketplace.' });
    } finally {
      if (this.mounted) this.setState({ loading: false });
    }
  }

  private async handleInstall(pluginSlug: string): Promise<void> {
    const { plugin, installedPlugin } = this.state;
    if (!plugin) return;
    const notify = this.runtime.notify.notify;
    const triggerRefresh = this.runtime.plugins?.triggerRefresh;
    try {
      this.setState({ installing: true });
      const isUpdate = Boolean(installedPlugin);
      notify('info', isUpdate ? 'Update Started' : 'Installation Started', `${isUpdate ? 'Updating' : 'Downloading and staging'} ${pluginSlug} v${plugin.version}...`);
      const result = await PluginInstallOperationService.startMarketplaceInstall(pluginSlug, plugin.version);
      await PluginInstallOperationService.waitForCompletion(result.operationId, (op: PluginInstallOperation | null) => this.setState({ installOperation: op }));
      const refreshedPlugin = await PluginVersionWaitService.waitForInstalledVersion(pluginSlug, plugin.version);
      this.setState({ installedPlugin: refreshedPlugin });
      if (triggerRefresh) {
        await Promise.resolve(triggerRefresh());
      }
      await this.fetchData();
      notify('success', isUpdate ? 'Update Complete' : 'Installation Complete', `Plugin "${pluginSlug}" v${plugin.version} is installed and active.`);
    } catch (err: any) {
      notify('error', 'Installation Failed', err.message || 'Failed to install plugin.');
    }
    finally {
      this.setState({ installOperation: null, installing: false });
    }
  }

  render(): React.ReactElement | null {
    const theme = this.theme;
    const {
      plugin,
      allVersions,
      selectedVersion,
      installedPlugin,
      loading,
      error,
      installing,
      installOperation,
      activeImageIndex,
      showLightbox,
    } = this.state;

    if (loading) {
      return <MarketplaceDetailLoading theme={theme} />;
    }

    if (error || !plugin) {
      return (
        <MarketplaceDetailError
          error={error}
          onBack={() => this.router.push(AdminConstants.ROUTES.PLUGINS.MARKETPLACE)}
        />
      );
    }

    const installedVersion = installedPlugin?.manifest?.version || installedPlugin?.version || null;
    const hasUpdate = Boolean(installedVersion && VersionComparisonService.isGreater(plugin.version, installedVersion));

    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
        <button
          onClick={() => this.router.push(AdminConstants.ROUTES.PLUGINS.MARKETPLACE)}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl border font-semibold transition-all ${theme === 'dark' ? 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800' : 'bg-white border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-100 hover:bg-indigo-50/30'}`}
        >
          <FrameworkIcons.Left size={16} />
          Back to Marketplace
        </button>

        <div className="flex flex-col lg:flex-row gap-8">
          <div className="flex-1 space-y-8">
            <MarketplaceDetailHeader
              plugin={plugin}
              theme={theme}
              allVersions={allVersions}
              selectedVersion={selectedVersion}
              installedPlugin={installedPlugin}
              onSelectVersion={(version) => this.setState({ selectedVersion: version })}
            />

            <MarketplaceScreenshots
              plugin={plugin}
              theme={theme}
              activeImageIndex={activeImageIndex}
              onOpenLightbox={() => this.setState({ showLightbox: true })}
              onSelectImage={(idx) => this.setState({ activeImageIndex: idx })}
            />

            <MarketplaceChangelog plugin={plugin} theme={theme} />
          </div>

          <MarketplaceDetailSidebar
            plugin={plugin}
            theme={theme}
            installedPlugin={installedPlugin}
            installedVersion={installedVersion}
            hasUpdate={hasUpdate}
            installing={installing}
            installOperation={installOperation}
            onInstall={() => this.handleInstall(plugin.slug)}
          />
        </div>

        <Lightbox
          images={(plugin.screenshots || []).map(s => typeof s === 'string' ? s : s.url)}
          currentIndex={activeImageIndex}
          isOpen={showLightbox}
          onClose={() => this.setState({ showLightbox: false })}
          onNavigate={(idx: number) => this.setState({ activeImageIndex: idx })}
          title={plugin.name}
        />
      </div>
    );
  }
}

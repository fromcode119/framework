import { ThemeMode } from '@fromcode119/core/client';
import { LoadedPluginHydration } from '@fromcode119/core/client';
import { NotificationType } from '@/components/enums/notification-type.enum';
import type { ReactElement } from 'react';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { FrameworkIcons } from '@fromcode119/react';
import { IPluginInstallOperation } from '@/lib/interfaces/plugin-install-operation.interface';
import { Lightbox } from '@/components/ui/view/lightbox.client';
import { PluginInstallOperationService } from '@/lib/plugin-install-operation-service';
import { PluginVersionWaitService } from '@/lib/plugin-version-wait-service';
import { VersionComparisonService } from '@/lib/version-comparison-service';
import { AdminComponent } from '@/components/view/admin-component.client';
import { MarketplaceDetailLoading } from '@/app/plugins/marketplace/[slug]/components/view/marketplace-detail-loading.client';
import { MarketplaceDetailError } from '@/app/plugins/marketplace/[slug]/components/view/marketplace-detail-error.client';
import { MarketplaceDetailHeader } from '@/app/plugins/marketplace/[slug]/components/view/marketplace-detail-header.client';
import { MarketplaceScreenshots } from '@/app/plugins/marketplace/[slug]/components/view/marketplace-screenshots.client';
import { MarketplaceChangelog } from '@/app/plugins/marketplace/[slug]/components/view/marketplace-changelog.client';
import { MarketplaceDetailSidebar } from '@/app/plugins/marketplace/[slug]/components/view/marketplace-detail-sidebar.client';
import { prop, state } from '@fromcode119/reactor';
import type { IPluginEntry } from '@fromcode119/core/client';
import { Screenshot } from '@fromcode119/core/client';

export class MarketplaceDetailPage extends AdminComponent {
  @prop declare params: Promise<{ slug: string }>;

  @state routeSlug = '';
  @state resolved = false;
  @state plugin: IPluginEntry | null = null;
  @state allVersions: IPluginEntry[] = [];
  @state selectedVersion = '';
  @state installedPlugin: any | null = null;
  @state loading = true;
  @state error: string | null = null;
  @state installing = false;
  @state installOperation: IPluginInstallOperation | null = null;
  @state activeImageIndex = 0;
  @state showLightbox = false;

  private mounted = false;
  private prevSelectedVersion = '';

  async componentDidMount(): Promise<void> {
    this.mounted = true;
    const params = await this.params;
    if (!this.mounted) return;
    this.prevSelectedVersion = this.selectedVersion;
    this.routeSlug = params.slug;
    this.resolved = true;
    void this.fetchData();
  }

  componentDidUpdate(): void {
    if (this.resolved && this.selectedVersion !== this.prevSelectedVersion) {
      this.prevSelectedVersion = this.selectedVersion;
      void this.fetchData();
    }
  }

  componentWillUnmount(): void {
    this.mounted = false;
  }

  private async fetchData(): Promise<void> {
    const slug = this.routeSlug;
    const selectedVersion = this.selectedVersion;
    this.loading = true;
    this.error = null;
    try {
      const [marketData, instData] = await Promise.all([
        AdminApi.get(AdminConstants.ENDPOINTS.PLUGINS.MARKETPLACE),
        AdminApi.get(AdminConstants.ENDPOINTS.PLUGINS.LIST)
      ]);

      const versions = (marketData.plugins || []).filter((p: any) => p.slug === slug);
      if (versions.length === 0) {
        if (this.mounted) this.error = 'Plugin not found in marketplace.';
      } else {
        // Sort descending
        versions.sort((a: any, b: any) => VersionComparisonService.isGreater(a.version, b.version) ? -1 : (VersionComparisonService.isSame(a.version, b.version) ? 0 : 1));

        const current = selectedVersion ? (versions.find((v: any) => v.version === selectedVersion) || versions[0]) : versions[0];
        if (!this.mounted) return;
        this.allVersions = versions;
        this.plugin = current;
        // Reset active image when plugin changes
        this.activeImageIndex = 0;
        // Hydrate so the sidebar's `state === PluginState.ACTIVE` check is a real comparison.
        this.installedPlugin = LoadedPluginHydration.one((instData || []).find((p: any) => (p.manifest?.slug || p.slug) === slug));
        if (!selectedVersion) {
          this.prevSelectedVersion = current.version;
          this.selectedVersion = current.version;
        }
      }
    } catch (err) {
      console.error('Failed to load plugin details', err);
      if (this.mounted) this.error = 'Failed to connect to the marketplace.';
    } finally {
      if (this.mounted) this.loading = false;
    }
  }

  private async handleInstall(pluginSlug: string): Promise<void> {
    const plugin = this.plugin;
    const installedPlugin = this.installedPlugin;
    if (!plugin) return;
    const notify = this.runtime.notify.notify;
    const triggerRefresh = this.runtime.plugins?.triggerRefresh;
    try {
      this.installing = true;
      const isUpdate = Boolean(installedPlugin);
      notify(NotificationType.INFO, isUpdate ? 'Update Started' : 'Installation Started', `${isUpdate ? 'Updating' : 'Downloading and staging'} ${pluginSlug} v${plugin.version}...`);
      const result = await PluginInstallOperationService.startMarketplaceInstall(pluginSlug, plugin.version);
      await PluginInstallOperationService.waitForCompletion(result.operationId, (op: IPluginInstallOperation | null) => { this.installOperation = op; });
      const refreshedPlugin = await PluginVersionWaitService.waitForInstalledVersion(pluginSlug, plugin.version);
      this.installedPlugin = LoadedPluginHydration.one(refreshedPlugin);
      if (triggerRefresh) {
        await Promise.resolve(triggerRefresh());
      }
      await this.fetchData();
      notify(NotificationType.SUCCESS, isUpdate ? 'Update Complete' : 'Installation Complete', `Plugin "${pluginSlug}" v${plugin.version} is installed and active.`);
    } catch (err: any) {
      notify(NotificationType.ERROR, 'Installation Failed', err.message || 'Failed to install plugin.');
    }
    finally {
      this.installOperation = null;
      this.installing = false;
    }
  }

  render(): ReactElement | null {
    const theme = this.theme;
    const plugin = this.plugin;
    const allVersions = this.allVersions;
    const selectedVersion = this.selectedVersion;
    const installedPlugin = this.installedPlugin;
    const loading = this.loading;
    const error = this.error;
    const installing = this.installing;
    const installOperation = this.installOperation;
    const activeImageIndex = this.activeImageIndex;
    const showLightbox = this.showLightbox;

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
      <div className="space-y-4 animate-in fade-in duration-500">
        <button
          onClick={() => this.router.push(AdminConstants.ROUTES.PLUGINS.MARKETPLACE)}
          className={`flex items-center gap-2 h-9 px-4 rounded-lg border font-semibold transition-all ${theme === ThemeMode.DARK ? 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800' : 'bg-white border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-100 hover:bg-indigo-50/30'}`}
        >
          <FrameworkIcons.Left size={16} />
          Back to Marketplace
        </button>

        <div className="flex flex-col lg:flex-row gap-5 items-start">
          <div className="flex-1 space-y-5 w-full">
            <MarketplaceDetailHeader
              plugin={plugin}
              theme={theme}
              allVersions={allVersions}
              selectedVersion={selectedVersion}
              installedPlugin={installedPlugin}
              onSelectVersion={(version) => { this.selectedVersion = version; }}
            />

            <MarketplaceScreenshots
              plugin={plugin}
              theme={theme}
              activeImageIndex={activeImageIndex}
              onOpenLightbox={() => { this.showLightbox = true; }}
              onSelectImage={(idx) => { this.activeImageIndex = idx; }}
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
          images={Screenshot.fromAll(plugin.screenshots).map((s) => s.url)}
          currentIndex={activeImageIndex}
          isOpen={showLightbox}
          onClose={() => { this.showLightbox = false; }}
          onNavigate={(idx: number) => { this.activeImageIndex = idx; }}
          title={plugin.name}
        />
      </div>
    );
  }
}

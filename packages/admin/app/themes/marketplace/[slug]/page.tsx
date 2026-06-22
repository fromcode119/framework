"use client";

import React from 'react';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants';
import { Lightbox } from '@/components/ui/lightbox';
import { VersionComparisonService } from '@/lib/version-comparison-service';
import { AdminComponent } from '@/components/admin-component';
import { ThemeMarketplaceHeader } from './theme-marketplace-header';
import { ThemeMarketplaceGallery } from './theme-marketplace-gallery';
import { ThemeMarketplaceAbout } from './theme-marketplace-about';
import { ThemeMarketplaceSidebar } from './theme-marketplace-sidebar';
import type {
  ThemeMarketplaceDetailPageProps,
  ThemeMarketplaceDetailPageState,
} from './theme-marketplace-detail-page.interfaces';

export default class ThemeMarketplaceDetailPage extends AdminComponent<ThemeMarketplaceDetailPageProps, ThemeMarketplaceDetailPageState> {
  private mounted = false;
  private prevSelectedVersion = '';

  state: ThemeMarketplaceDetailPageState = {
    routeSlug: '',
    resolved: false,
    theme: null,
    allVersions: [],
    selectedVersion: '',
    installedTheme: null,
    loading: true,
    installing: false,
    activeImageIndex: 0,
    showLightbox: false,
  };

  async componentDidMount(): Promise<void> {
    this.mounted = true;
    const params = await this.props.params;
    if (!this.mounted) return;
    this.prevSelectedVersion = this.state.selectedVersion;
    this.setState({ routeSlug: params.slug, resolved: true }, () => void this.fetchMarketplaceTheme());
  }

  componentDidUpdate(): void {
    if (this.state.resolved && this.state.selectedVersion !== this.prevSelectedVersion) {
      this.prevSelectedVersion = this.state.selectedVersion;
      void this.fetchMarketplaceTheme();
    }
  }

  componentWillUnmount(): void {
    this.mounted = false;
  }

  private async fetchMarketplaceTheme(): Promise<void> {
    const { routeSlug: slug, selectedVersion } = this.state;
    try {
      const [regResponse, instResponse] = await Promise.all([
        AdminApi.get(AdminConstants.ENDPOINTS.THEMES.MARKETPLACE),
        AdminApi.get(AdminConstants.ENDPOINTS.THEMES.LIST)
      ]);

      const themes = Array.isArray(regResponse) ? regResponse : (regResponse.themes || []);
      const versions = themes.filter((t: any) => t.slug === slug);

      if (versions.length > 0) {
        // Sort versions descending
        versions.sort((a: any, b: any) => VersionComparisonService.isGreater(a.version, b.version) ? -1 : (VersionComparisonService.isSame(a.version, b.version) ? 0 : 1));

        // Default to latest or selected
        const current = selectedVersion ? (versions.find((v: any) => v.version === selectedVersion) || versions[0]) : versions[0];

        // Find if installed
        const installed = (instResponse || []).find((t: any) => t.slug === slug);
        if (!this.mounted) return;
        this.setState({
          allVersions: versions,
          theme: current,
          activeImageIndex: 0,
          installedTheme: installed,
        });
        if (!selectedVersion) {
          this.prevSelectedVersion = current.version;
          this.setState({ selectedVersion: current.version });
        }
      } else {
        this.router.push(AdminConstants.ROUTES.THEMES.MARKETPLACE);
      }
    } catch (err) {
      console.error("Failed to fetch marketplace theme", err);
    } finally {
      if (this.mounted) this.setState({ loading: false });
    }
  }

  private async handleInstall(): Promise<void> {
    const { theme, installedTheme, routeSlug: slug } = this.state;
    if (!theme) return;
    const notify = this.runtime.notify.notify;
    const triggerRefresh = this.runtime.plugins?.triggerRefresh;
    this.setState({ installing: true });
    try {
      notify('info', installedTheme ? 'Update Started' : 'Installation Started', `Downloading and setting up ${theme.name} v${theme.version}...`);
      await AdminApi.post(`${AdminConstants.ENDPOINTS.THEMES.INSTALL(theme.slug)}?version=${theme.version}`);
      notify('success', installedTheme ? 'Update Complete' : 'Installation Success', `${theme.name} v${theme.version} has been installed.`);
      if (triggerRefresh) {
        await Promise.resolve(triggerRefresh());
      }

      // Refresh local state
      const instResponse = await AdminApi.get(AdminConstants.ENDPOINTS.THEMES.LIST);
      const installed = (instResponse || []).find((t: any) => t.slug === slug);
      if (this.mounted) this.setState({ installedTheme: installed });

    } catch (err: any) {
      notify('error', 'Installation Failed', err.message);
    } finally {
      this.setState({ installing: false });
    }
  }

  render(): React.ReactElement | null {
    const adminTheme = this.theme;
    const {
      theme,
      allVersions,
      selectedVersion,
      installedTheme,
      loading,
      installing,
      activeImageIndex,
      showLightbox,
    } = this.state;

    if (loading) {
      return (
        <div className="flex h-[60vh] items-center justify-center">
          <div className="h-12 w-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      );
    }

    if (!theme) return null;

    const installedVersion = installedTheme?.version || null;
    const hasUpdate = Boolean(installedVersion && VersionComparisonService.isGreater(theme.version, installedVersion));

    // Normalize screenshots for display
    const screenshots = (theme.screenshots || []).map(s => typeof s === 'string' ? s : s.url);

    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <ThemeMarketplaceHeader
          theme={theme}
          adminTheme={adminTheme}
          allVersions={allVersions}
          selectedVersion={selectedVersion}
          installedTheme={installedTheme}
          hasUpdate={hasUpdate}
          installing={installing}
          onSelectVersion={(version) => this.setState({ selectedVersion: version })}
          onInstall={() => void this.handleInstall()}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pb-12">
          <div className="lg:col-span-2 space-y-6">
              <ThemeMarketplaceGallery
                theme={theme}
                adminTheme={adminTheme}
                screenshots={screenshots}
                activeImageIndex={activeImageIndex}
                onOpenLightbox={() => this.setState({ showLightbox: true })}
                onSelectImage={(idx) => this.setState({ activeImageIndex: idx })}
              />

              <ThemeMarketplaceAbout theme={theme} adminTheme={adminTheme} />
          </div>

          <ThemeMarketplaceSidebar
            theme={theme}
            adminTheme={adminTheme}
            installedTheme={installedTheme}
            installedVersion={installedVersion}
            hasUpdate={hasUpdate}
            installing={installing}
            onInstall={() => void this.handleInstall()}
          />
        </div>

        <Lightbox
          images={screenshots}
          currentIndex={activeImageIndex}
          isOpen={showLightbox}
          onClose={() => this.setState({ showLightbox: false })}
          onNavigate={(idx: number) => this.setState({ activeImageIndex: idx })}
          title={theme.name}
        />
      </div>
    );
  }
}

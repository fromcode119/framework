import { NotificationType } from '@/components/enums/notification-type.enum';
import type { ReactElement } from 'react';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { Lightbox } from '@/components/ui/view/lightbox.client';
import { VersionComparisonService } from '@/lib/version-comparison-service';
import { AdminComponent } from '@/components/view/admin-component.client';
import { ThemeMarketplaceHeader } from '@/app/themes/marketplace/[slug]/components/view/theme-marketplace-header.client';
import { ThemeMarketplaceGallery } from '@/app/themes/marketplace/[slug]/components/view/theme-marketplace-gallery.client';
import { ThemeMarketplaceAbout } from '@/app/themes/marketplace/[slug]/components/view/theme-marketplace-about.client';
import { ThemeMarketplaceSidebar } from '@/app/themes/marketplace/[slug]/components/view/theme-marketplace-sidebar.client';
import { prop, state } from '@fromcode119/reactor';
import type { IMarketplaceTheme } from '@fromcode119/core/client';
import { Screenshot } from '@fromcode119/core/client';

export class ThemeMarketplaceDetailPage extends AdminComponent {
  @prop declare params: Promise<{ slug: string }>;

  @state routeSlug = '';
  @state resolved = false;
  @state themeDetail: IMarketplaceTheme | null = null;
  @state allVersions: IMarketplaceTheme[] = [];
  @state selectedVersion = '';
  @state installedTheme: any | null = null;
  @state loading = true;
  @state installing = false;
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
    void this.fetchMarketplaceTheme();
  }

  componentDidUpdate(): void {
    if (this.resolved && this.selectedVersion !== this.prevSelectedVersion) {
      this.prevSelectedVersion = this.selectedVersion;
      void this.fetchMarketplaceTheme();
    }
  }

  componentWillUnmount(): void {
    this.mounted = false;
  }

  private async fetchMarketplaceTheme(): Promise<void> {
    const slug = this.routeSlug;
    const selectedVersion = this.selectedVersion;
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
        this.allVersions = versions;
        this.themeDetail = current;
        this.activeImageIndex = 0;
        this.installedTheme = installed;
        if (!selectedVersion) {
          this.prevSelectedVersion = current.version;
          this.selectedVersion = current.version;
        }
      } else {
        this.router.push(AdminConstants.ROUTES.THEMES.MARKETPLACE);
      }
    } catch (err) {
      console.error("Failed to fetch marketplace theme", err);
    } finally {
      if (this.mounted) this.loading = false;
    }
  }

  private async handleInstall(): Promise<void> {
    const theme = this.themeDetail;
    const installedTheme = this.installedTheme;
    const slug = this.routeSlug;
    if (!theme) return;
    const notify = this.runtime.notify.notify;
    const triggerRefresh = this.runtime.plugins?.triggerRefresh;
    this.installing = true;
    try {
      notify(NotificationType.INFO, installedTheme ? 'Update Started' : 'Installation Started', `Downloading and setting up ${theme.name} v${theme.version}...`);
      await AdminApi.post(`${AdminConstants.ENDPOINTS.THEMES.INSTALL(theme.slug)}?version=${theme.version}`);
      notify(NotificationType.SUCCESS, installedTheme ? 'Update Complete' : 'Installation Success', `${theme.name} v${theme.version} has been installed.`);
      if (triggerRefresh) {
        await Promise.resolve(triggerRefresh());
      }

      // Refresh local state
      const instResponse = await AdminApi.get(AdminConstants.ENDPOINTS.THEMES.LIST);
      const installed = (instResponse || []).find((t: any) => t.slug === slug);
      if (this.mounted) this.installedTheme = installed;

    } catch (err: any) {
      notify(NotificationType.ERROR, 'Installation Failed', err.message);
    } finally {
      this.installing = false;
    }
  }

  render(): ReactElement | null {
    const adminTheme = this.theme;
    const theme = this.themeDetail;
    const allVersions = this.allVersions;
    const selectedVersion = this.selectedVersion;
    const installedTheme = this.installedTheme;
    const loading = this.loading;
    const installing = this.installing;
    const activeImageIndex = this.activeImageIndex;
    const showLightbox = this.showLightbox;

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
    const screenshots = Screenshot.fromAll(theme.screenshots).map((s) => s.url);

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
          onSelectVersion={(version) => { this.selectedVersion = version; }}
          onInstall={() => void this.handleInstall()}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pb-12">
          <div className="lg:col-span-2 space-y-6">
              <ThemeMarketplaceGallery
                theme={theme}
                adminTheme={adminTheme}
                screenshots={screenshots}
                activeImageIndex={activeImageIndex}
                onOpenLightbox={() => { this.showLightbox = true; }}
                onSelectImage={(idx) => { this.activeImageIndex = idx; }}
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
          onClose={() => { this.showLightbox = false; }}
          onNavigate={(idx: number) => { this.activeImageIndex = idx; }}
          title={theme.name}
        />
      </div>
    );
  }
}

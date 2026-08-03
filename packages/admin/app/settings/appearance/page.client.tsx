import { ThemeMode } from '@fromcode119/core/client';
import { NotificationType } from '@/components/enums/notification-type.enum';
import type { ReactNode } from 'react';
import { RouteConstants, ApiVersionUtils, SystemConstants } from '@fromcode119/core/client';
import { AdminApi } from '@/lib/api';
import { AdminSystemSettingsClient } from '@/lib/settings/admin-system-settings-client';
import { ActiveAdminAppearanceService } from '@/lib/appearance/active-admin-appearance-service';
import { AdminComponent } from '@/components/view/admin-component.client';
import { Loader } from '@/components/ui/view/loader.client';
import { FrameworkIcons } from '@fromcode119/react';
import { CompactPageHeader } from '@/components/ui/view/compact-page-header.client';
import { state, bound } from '@fromcode119/reactor';
import { AppearanceActiveCard } from '@/app/settings/appearance/appearance-active-card';
import { AppearanceElevationCard } from '@/app/settings/appearance/appearance-elevation-card';
import { SurfaceElevationService } from '@/lib/theme/surface-elevation-service';
import { AppearanceMarketplaceCard } from '@/app/settings/appearance/appearance-marketplace-card';
import { AppearanceInstallUrlCard } from '@/app/settings/appearance/appearance-install-url-card';
import { AppearanceItem } from '@/app/settings/appearance/appearance-item';
import { AppearanceCatalogItem } from '@/app/settings/appearance/appearance-catalog-item';

export class AppearanceSettingsPage extends AdminComponent {
  private static readonly APPEARANCES_BASE = ApiVersionUtils.withVersion(RouteConstants.SEGMENTS.APPEARANCES);
  private static readonly CATALOG_PATH = `${AppearanceSettingsPage.APPEARANCES_BASE}${RouteConstants.SEGMENTS.APPEARANCES_CATALOG}`;
  private static readonly INSTALL_PATH = `${AppearanceSettingsPage.APPEARANCES_BASE}${RouteConstants.SEGMENTS.APPEARANCES_INSTALL}`;
  
  @state items: AppearanceItem[] = [];
  @state catalog: AppearanceCatalogItem[] = [];
  @state active = 'default';
  @state shadows = true;
  @state loading = true;
  @state url = '';
  @state busy = false;

  private get dark(): boolean {
    return this.theme === ThemeMode.DARK;
  }

  private get catalogBySlug(): Record<string, AppearanceCatalogItem> {
    return Object.fromEntries(this.catalog.map((c) => [c.slug, c])) as Record<string, AppearanceCatalogItem>;
  }

  private get notInstalled(): AppearanceCatalogItem[] {
    return this.catalog.filter((c) => !c.installed);
  }

  componentDidMount(): void {
    void this.load();
  }

  private notify(type: NotificationType, message: string): void {
    this.runtime.notify.addNotification({ type, title: 'Appearance', message });
  }

  private async load(): Promise<void> {
    this.loading = true;
    try {
      const [list, cat, settings] = await Promise.all([
        AdminApi.get(AppearanceSettingsPage.APPEARANCES_BASE),
        AdminApi.get(AppearanceSettingsPage.CATALOG_PATH).catch(() => ({ appearances: [] })),
        AdminSystemSettingsClient.getAll(),
      ]);
      this.items = (((list as any)?.appearances || []) as any[]).map(AppearanceItem.from);
      this.catalog = (((cat as any)?.appearances || []) as any[]).map(AppearanceCatalogItem.from);
      this.active = String((settings as any)?.admin_appearance || 'default').trim() || 'default';
      this.shadows = SurfaceElevationService.isEnabled(settings as Record<string, unknown>);
    } catch (e: any) {
      this.notify(NotificationType.ERROR, e?.message || 'Failed to load appearances');
    } finally {
      this.loading = false;
    }
  }

  /** Applies immediately (so the change is visible on this very page), then persists. */
  @bound
  async setShadows(next: boolean): Promise<void> {
    this.shadows = next;
    SurfaceElevationService.apply(next);
    this.busy = true;
    try {
      await AdminSystemSettingsClient.update({ [SystemConstants.META_KEY.ADMIN_SHADOWS]: next });
    } catch (e: any) {
      this.shadows = !next;
      SurfaceElevationService.apply(!next);
      this.notify(NotificationType.ERROR, e?.message || 'Failed to save shadow setting');
    } finally {
      this.busy = false;
    }
  }

  @bound
  async switchTo(slug: string): Promise<void> {
    this.busy = true;
    try {
      await AdminSystemSettingsClient.update({ admin_appearance: slug === 'default' ? '' : slug });
      ActiveAdminAppearanceService.rememberHint(slug);
      this.notify(NotificationType.SUCCESS, `Switched to "${slug}". Reloading…`);
      setTimeout(() => window.location.reload(), 600);
    } catch (e: any) {
      this.notify(NotificationType.ERROR, e?.message || 'Failed to switch appearance');
      this.busy = false;
    }
  }

  private async install(payload: { slug?: string; url?: string }, doneMsg: string): Promise<void> {
    this.busy = true;
    try {
      await AdminApi.post(AppearanceSettingsPage.INSTALL_PATH, payload);
      this.notify(NotificationType.SUCCESS, doneMsg);
      if (payload.url) this.url = '';
      await this.load();
    } catch (e: any) {
      this.notify(NotificationType.ERROR, e?.message || 'Install failed');
    } finally {
      this.busy = false;
    }
  }

  @bound
  updateInstalled(item: AppearanceItem): void {
    if (this.catalogBySlug[item.slug]?.updateAvailable) {
      void this.install({ slug: item.slug }, `Updated "${item.slug}".`);
      return;
    }
    if (item.sourceUrl) void this.install({ url: item.sourceUrl }, `Re-installed "${item.slug}".`);
  }

  @bound
  async remove(slug: string): Promise<void> {
    this.busy = true;
    try {
      await AdminApi.delete(`${AppearanceSettingsPage.APPEARANCES_BASE}/${encodeURIComponent(slug)}`);
      this.notify(NotificationType.SUCCESS, `Removed "${slug}".`);
      await this.load();
    } catch (e: any) {
      this.notify(NotificationType.ERROR, e?.message || 'Remove failed');
    } finally {
      this.busy = false;
    }
  }

  @bound
  installFromCatalog(slug: string): void {
    void this.install({ slug }, `Installed "${slug}".`);
  }

  @bound
  installFromUrl(): void {
    void this.install({ url: this.url }, 'Appearance installed.');
  }

  @bound
  changeUrl(value: string): void {
    this.url = value;
  }

  render(): ReactNode {
    if (this.loading) return <div className="p-12"><Loader label="Loading appearances…" /></div>;

    return (
      <div className="flex flex-col h-full animate-in fade-in duration-500">
        <CompactPageHeader
          theme={this.theme}
          icon={<FrameworkIcons.Palette size={18} strokeWidth={2} />}
          title="Appearance"
          subtitle="Admin look & feel — separate from plugins & themes"
        />

        <div className="p-6 w-full space-y-8">
          <AppearanceElevationCard enabled={this.shadows} busy={this.busy} onChange={this.setShadows} />

          <AppearanceActiveCard
            items={this.items}
            catalogBySlug={this.catalogBySlug}
            active={this.active}
            busy={this.busy}
            dark={this.dark}
            onSwitch={this.switchTo}
            onUpdate={this.updateInstalled}
            onRemove={this.remove}
          />

          <AppearanceMarketplaceCard
            entries={this.notInstalled}
            busy={this.busy}
            dark={this.dark}
            onInstall={this.installFromCatalog}
          />

          <AppearanceInstallUrlCard
            url={this.url}
            busy={this.busy}
            onChange={this.changeUrl}
            onInstall={this.installFromUrl}
          />
        </div>
      </div>
    );
  }
}

import { ThemeSettingsTab } from '@/app/themes/[slug]/enums/theme-settings-tab.enum';
import { ThemeMode } from '@fromcode119/core/client';
import type { ReactElement } from 'react';
import { Platform, bound, prop, state } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminComponent } from '@/components/view/admin-component.client';
import { SiteScopeGate } from '@/components/view/site-scope-gate.client';
import { ThemeNotFound } from '@/app/themes/[slug]/components/view/theme-not-found.client';
import { ThemeSettingsController } from '@/app/themes/[slug]/components/view/theme-settings-controller.client';
import { ThemeSettingsRenderModel } from '@/app/themes/[slug]/components/view/theme-settings-render-model.client';
import { ThemeSettingsHeader } from '@/app/themes/[slug]/components/view/theme-settings-header.client';
import { ThemeSettingsOverviewPanel } from '@/app/themes/[slug]/components/view/theme-settings-overview-panel.client';
import { ThemeSettingsSections } from '@/app/themes/[slug]/components/view/theme-settings-sections.client';
import { ThemeSettingsMaintenancePanel } from '@/app/themes/[slug]/components/view/theme-settings-maintenance-panel.client';
import { ThemeDetailTabs } from '@/app/themes/[slug]/components/view/theme-detail-tabs.client';
import { ThemeSettingsDialogs } from '@/app/themes/[slug]/components/view/theme-settings-dialogs.client';
import type { ITheme } from '@/app/themes/[slug]/interfaces/theme.interface';
import type { IThemeSettingsPageView } from '@/app/themes/[slug]/interfaces/theme-settings-page-view.interface';
import type { IThemeSettingsPageHost } from '@/app/themes/[slug]/interfaces/theme-settings-page-host.interface';
import type { IPluginsContextSurface } from '@/app/interfaces/plugins-context-surface.interface';
import type { NotificationType } from '@/components/enums/notification-type.enum';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { SiteStorefrontClient } from '@/lib/tenants/site-storefront-client';

export class ThemeSettingsPage extends AdminComponent implements IThemeSettingsPageView, IThemeSettingsPageHost {
  @prop declare params: Promise<{ slug: string }>;
  @prop declare searchParams?: Promise<Record<string, string | string[]>>;

  /** Public because `ThemeSettingsController` checks it before writing state — see IThemeSettingsPageHost. */
  mounted = false;
  private prevRefreshVersion: number | undefined = undefined;

  @state routeSlug = '';
  @state resolved = false;
  @state themeDetail: ITheme | null = null;
  @state marketplaceVersion: string | null = null;
  @state loading = true;
  @state activeTab: ThemeSettingsTab = ThemeSettingsTab.OVERVIEW;
  /** The Settings tab's open section (`?section=`); empty means the first. */
  @state activeSection = '';
  @state isUpdating = false;
  @state isSaving = false;
  @state isReseeding = false;
  @state isResettingTheme = false;
  @state isDeleting = false;
  @state isDeleteConfirmOpen = false;
  @state isRunSeedsConfirmOpen = false;
  @state isResetThemeConfirmOpen = false;
  @state dbConfig: Record<string, unknown> = {};
  @state tempVariables: Record<string, string> = {};
  @state tempDefaultLayout = '';
  @state tempSettings: Record<string, unknown> = {};
  /** The bound site's own address — where "Open Site" goes when the theme names none. */
  @state siteStorefrontUrl = '';

  /**
   * `AdminComponent` exposes runtime/theme/router as PROTECTED members, so the controller and the view
   * components — which are separate classes, not subclasses — cannot read them. These accessors are the
   * page's public surface for exactly what those collaborators need, and nothing more.
   */
  private get pluginsContext(): IPluginsContextSurface | null {
    return this.runtime.plugins ?? null;
  }

  get adminTheme(): ThemeMode {
    return this.theme;
  }

  get pluginSettings(): Record<string, unknown> | null {
    return this.pluginsContext?.settings ?? null;
  }

  notify(type: NotificationType, title: string, message: string): void {
    this.runtime.notify.notify(type, title, message);
  }

  triggerRefresh(): void {
    this.pluginsContext?.triggerRefresh();
  }

  goToThemesList(): void {
    this.router.push(AdminConstants.ROUTES.THEMES.ROOT);
  }

  async componentDidMount(): Promise<void> {
    this.mounted = true;
    SiteStorefrontClient.current().then((url) => { if (this.mounted) this.siteStorefrontUrl = url; });
    const params = await this.params;
    const searchParams = this.searchParams ? await this.searchParams : undefined;
    if (!this.mounted) return;
    const tab = searchParams?.tab;
    const nextTab = ThemeSettingsTab.has(String(tab ?? '')) ? ThemeSettingsTab.resolve(tab) : this.activeTab;
    this.prevRefreshVersion = this.pluginsContext?.refreshVersion;
    this.routeSlug = params.slug;
    this.resolved = true;
    this.activeTab = nextTab;
    this.activeSection = String(searchParams?.section ?? '');
    void ThemeSettingsController.fetchTheme(this);
  }

  componentDidUpdate(): void {
    if (this.resolved && this.pluginsContext?.refreshVersion !== this.prevRefreshVersion) {
      this.prevRefreshVersion = this.pluginsContext?.refreshVersion;
      void ThemeSettingsController.fetchTheme(this);
    }
  }

  componentWillUnmount(): void {
    this.mounted = false;
  }

  handleActivate(): Promise<void> { return ThemeSettingsController.handleActivate(this); }
  handleUpdate(): Promise<void> { return ThemeSettingsController.handleUpdate(this); }
  handleSaveConfig(): Promise<void> { return ThemeSettingsController.handleSaveConfig(this); }
  handleDelete(): Promise<void> { return ThemeSettingsController.handleDelete(this); }
  handleRunSeeds(): Promise<void> { return ThemeSettingsController.handleRunSeeds(this); }
  handleResetTheme(): Promise<void> { return ThemeSettingsController.handleResetTheme(this); }

  openDeleteConfirm(): void { if (this.themeDetail) this.isDeleteConfirmOpen = true; }
  openRunSeedsConfirm(): void { if (this.themeDetail) this.isRunSeedsConfirmOpen = true; }
  openResetThemeConfirm(): void { if (this.themeDetail) this.isResetThemeConfirmOpen = true; }

  closeDeleteConfirm(): void { this.isDeleteConfirmOpen = false; }
  closeRunSeedsConfirm(): void { this.isRunSeedsConfirmOpen = false; }
  closeResetThemeConfirm(): void { this.isResetThemeConfirmOpen = false; }

  handleVariableChange(key: string, value: string): void {
    this.tempVariables = { ...this.tempVariables, [key]: value };
  }

  handleDefaultLayoutChange(value: string): void {
    this.tempDefaultLayout = value;
  }

  handleSettingChange(key: string, value: unknown): void {
    this.tempSettings = { ...this.tempSettings, [key]: value };
  }

  /** Opens a tab (and, on Settings, a section) and records both in the URL, so a reload or a shared link lands there. */
  @bound handleTabChange(tabId: ThemeSettingsTab, section = ''): void {
    this.activeTab = tabId;
    this.activeSection = section;
    const currentSearch = Platform.isBrowser ? window.location.search : '';
    const params = new URLSearchParams(currentSearch);
    params.set('tab', tabId.value);
    if (section) params.set('section', section);
    else params.delete('section');
    this.router.replace(`${this.pathname}?${params.toString()}`, { scroll: false });
  }

  render(): ReactElement | null {
    if (this.loading) {
      return (
        <div className="flex h-[60vh] items-center justify-center">
          <FrameworkIcons.Loader className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
      );
    }
    // Narrowed HERE, once, so `ThemeSettingsRenderModel` (and every view reading `model.themeDetail`)
    // gets a non-null theme instead of re-testing it in six components.
    const themeDetail = this.themeDetail;
    // A theme's settings are a SITE's: in Platform scope the config read is refused and nothing loads,
    // so the gate says where the page lives. Inside a site, no theme here means this site cannot see
    // that slug — said, rather than the empty screen a bookmark used to open.
    if (!themeDetail) {
      return (
        <SiteScopeGate what={this.pathname}>
          <ThemeNotFound themeSlug={this.routeSlug} themesHref={AdminConstants.ROUTES.THEMES.ROOT} />
        </SiteScopeGate>
      );
    }

    const model = ThemeSettingsRenderModel.build(this, themeDetail);
    const { adminTheme, activeTab } = model;
    const dark = adminTheme === ThemeMode.DARK;
    return (
      <div className="mx-auto max-w-5xl space-y-5 pb-12">
        <ThemeSettingsHeader page={this} model={model} />
        <section className={`overflow-hidden rounded-2xl border ${dark ? 'border-slate-800 bg-slate-900/40' : 'border-slate-200 bg-white shadow-sm'}`}>
          <ThemeDetailTabs activeTab={activeTab} onTabChange={this.handleTabChange} theme={adminTheme} />
          {activeTab === ThemeSettingsTab.SETTINGS ? <ThemeSettingsSections page={this} model={model} /> : (
            activeTab === ThemeSettingsTab.MAINTENANCE
              ? <div className="p-6"><ThemeSettingsMaintenancePanel page={this} model={model} /></div>
              : <ThemeSettingsOverviewPanel page={this} model={model} />
          )}
        </section>
        <ThemeSettingsDialogs page={this} model={model} />
      </div>
    );
  }
}

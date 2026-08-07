import { ThemeSettingsTab } from '@/app/themes/[slug]/enums/theme-settings-tab.enum';
import { ThemeMode } from '@fromcode119/core/client';
import type { ReactElement } from 'react';
import { Platform, prop, state } from '@fromcode119/reactor';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminComponent } from '@/components/view/admin-component.client';
import { ThemeSettingsController } from '@/app/themes/[slug]/components/view/theme-settings-controller.client';
import { ThemeSettingsRenderModel } from '@/app/themes/[slug]/components/view/theme-settings-render-model.client';
import { ThemeSettingsHeader } from '@/app/themes/[slug]/components/view/theme-settings-header.client';
import { ThemeSettingsOverviewPanel } from '@/app/themes/[slug]/components/view/theme-settings-overview-panel.client';
import { ThemeSettingsVariablesPanel } from '@/app/themes/[slug]/components/view/theme-settings-variables-panel.client';
import { ThemeSettingsLayoutsPanel } from '@/app/themes/[slug]/components/view/theme-settings-layouts-panel.client';
import { ThemeSettingsExtensionsPanel } from '@/app/themes/[slug]/components/view/theme-settings-extensions-panel.client';
import { ThemeSettingsSidebar } from '@/app/themes/[slug]/components/view/theme-settings-sidebar.client';
import { ThemeSettingsDialogs } from '@/app/themes/[slug]/components/view/theme-settings-dialogs.client';
import type { ITheme } from '@/app/themes/[slug]/interfaces/theme.interface';
import type { IThemeSettingsPageView } from '@/app/themes/[slug]/interfaces/theme-settings-page-view.interface';
import type { IThemeSettingsPageHost } from '@/app/themes/[slug]/interfaces/theme-settings-page-host.interface';
import type { IPluginsContextSurface } from '@/app/interfaces/plugins-context-surface.interface';
import type { NotificationType } from '@/components/enums/notification-type.enum';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { AdminClass } from '@/lib/admin-class';

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
  @state tempLayouts: Record<string, string> = {};
  @state tempSettings: Record<string, unknown> = {};

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
    const params = await this.params;
    const searchParams = this.searchParams ? await this.searchParams : undefined;
    if (!this.mounted) return;
    const tab = searchParams?.tab;
    const nextTab = ThemeSettingsTab.has(String(tab ?? '')) ? ThemeSettingsTab.resolve(tab) : this.activeTab;
    this.prevRefreshVersion = this.pluginsContext?.refreshVersion;
    this.routeSlug = params.slug;
    this.resolved = true;
    this.activeTab = nextTab;
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

  handleLayoutChange(key: string, value: string): void {
    this.tempLayouts = { ...this.tempLayouts, [key]: value };
  }

  handleSettingChange(key: string, value: unknown): void {
    this.tempSettings = { ...this.tempSettings, [key]: value };
  }

  handleTabChange(tabId: ThemeSettingsTab): void {
    this.activeTab = tabId;
    const currentSearch = Platform.isBrowser ? window.location.search : '';
    const params = new URLSearchParams(currentSearch);
    params.set('tab', tabId.value);
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
    if (!themeDetail) return null;

    const model = ThemeSettingsRenderModel.build(this, themeDetail);
    const { adminTheme, activeTab } = model;
    // Enum MEMBERS, not their raw strings: `activeTab === 'settings'` is always false against a
    // `ThemeSettingsTab`, so no tab ever highlighted and clicking "Theme Builder" stored a bare string
    // that matched neither panel — the column rendered empty.
    const tabs = [
      { id: ThemeSettingsTab.OVERVIEW, label: 'Overview', icon: FrameworkIcons.Palette },
      { id: ThemeSettingsTab.SETTINGS, label: 'Theme Builder', icon: FrameworkIcons.Box }
    ];

    return (
      <div className="w-full space-y-6 animate-in fade-in duration-500">
        <ThemeSettingsHeader page={this} model={model} />

        <div className={`flex gap-2 p-1.5 ${AdminClass.SURFACE} w-fit backdrop-blur-xl border transition-all duration-300 ${adminTheme === ThemeMode.DARK ? 'bg-slate-900/50 border-white/5' : 'bg-slate-100/80 border-slate-200/60 shadow-sm'}`}>
          {tabs.map((tab) => (
            <button
              key={tab.id.value}
              onClick={() => this.handleTabChange(tab.id)}
              className={`flex items-center gap-2 px-6 py-2.5 text-[11px] font-semibold uppercase tracking-wide transition-all ${AdminClass.SURFACE} ${activeTab === tab.id ? (adminTheme === ThemeMode.DARK ? 'bg-slate-800 text-indigo-400 shadow-xl shadow-indigo-500/10' : 'bg-white text-indigo-600 shadow-lg shadow-indigo-500/5 ring-1 ring-slate-200/50') : (adminTheme === ThemeMode.DARK ? 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50' : 'text-slate-500 hover:text-slate-900 hover:bg-white/50')}`}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="w-full">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pb-10">
            <div className="lg:col-span-2 space-y-6">
              {activeTab === ThemeSettingsTab.OVERVIEW && <ThemeSettingsOverviewPanel page={this} model={model} />}
              {activeTab === ThemeSettingsTab.SETTINGS && (
                <div className="space-y-6">
                  <ThemeSettingsVariablesPanel page={this} model={model} />
                  <ThemeSettingsLayoutsPanel page={this} model={model} />
                  <ThemeSettingsExtensionsPanel page={this} model={model} />
                </div>
              )}
            </div>

            <ThemeSettingsSidebar page={this} model={model} />
          </div>
        </div>

        <ThemeSettingsDialogs page={this} model={model} />
      </div>
    );
  }
}

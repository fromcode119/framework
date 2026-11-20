import { Tabs } from '@/components/ui/view/tabs.client';
import { SecurityTab } from '@/app/settings/security/enums/security-tab.enum';
import { NotificationType } from '@/components/enums/notification-type.enum';
import type { ReactNode, SetStateAction } from 'react';
import { state, bound, watch } from '@fromcode119/react-class-components';
import { PlatformAccess } from '@/lib/tenants/platform-access';
import { AdminComponent } from '@/components/view/admin-component.client';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { Loader } from '@/components/ui/view/loader.client';
import { LoadErrorPanel } from '@/components/ui/view/load-error-panel.client';
import { SecurityDashboard } from '@/app/settings/security/security-dashboard';
import { SecuritySettingsCards } from '@/app/settings/security/security-settings-cards';
import { SecuritySettingsIo } from '@/app/settings/security/security-settings-io';
import { CompactPageHeader } from '@/components/ui/view/compact-page-header.client';
import { SettingsSaveBar } from '@/components/ui/view/settings-save-bar.client';
import { PlatformSettingLocks } from '@/lib/settings/platform-setting-locks';
import { SettingsPageScope } from '@/lib/settings/settings-page-scope';
import { SecuritySettingsKeys } from '@/app/settings/security/security-settings-keys';
import { SiteScopePanel } from '@/components/view/site-scope-panel.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

export class SecuritySettingsPage extends AdminComponent {
  @state isSaving = false;
  @state isLoading = true;
  @state activeTab: SecurityTab = SecurityTab.DASHBOARD;
  @state stats: any = null;
  @state statsError: string | null = null;
  /**
   * `null` means NEVER LOADED — it is not an empty form. This used to be seeded with
   * `rate_limit_max: '100'` etc.; those numbers are already DECLARED server-side
   * (`packages/api/src/server/server-settings-service.ts`), so the copies here were a second, hidden
   * default — and when the settings GET failed they rendered as if they were the stored configuration
   * and "Update Security" wrote them over the real values. A failed load now shows `loadError` and the
   * Save control is not rendered at all.
   */
  @state settings: Record<string, string> | null = null;
  /** What the server last returned — the baseline a save compares against, so it sends only changes. */
  private loaded: Record<string, string> = {};
  @state loadError: string | null = null;
  /**
   * Whether this screen's settings belong to the scope the console is in.
   *
   * Every key here is per-site. In the platform scope the API refuses the save, so rendering the form
   * would offer twenty-three controls and lose all twenty-three edits at once. Null until the answer
   * arrives; nothing is hidden before then.
   */
  @state scope: SettingsPageScope | null = null;

  /**
   * The DASHBOARD tab reports the runtime isolation of the box every site runs on — plugin processes,
   * their limits, policy violations. That is the platform's business, and the endpoint behind it says
   * so. The SETTINGS tab is not: password policy, login protection and the audit trail are stored per
   * site, so a site administrator configures its own.
   */
  private get canManagePlatform(): boolean {
    return PlatformAccess.canManagePlatform(this.auth.user);
  }

  async componentDidMount(): Promise<void> {
    // A link may open the Settings tab directly (`?tab=settings`), e.g. from an account's 2FA card.
    const askedTab = new URLSearchParams(window.location.search).get('tab');
    if (!this.canManagePlatform || askedTab === SecurityTab.SETTINGS.value) this.activeTab = SecurityTab.SETTINGS;
    await this.loadPageData();
    this.scope = new SettingsPageScope(await PlatformSettingLocks.load(), SecuritySettingsKeys.ALL);
  }

  /** Nothing on the Settings tab can be saved in this scope. */
  private get settingsOutOfScope(): boolean {
    return this.scope?.isEmpty === true;
  }

  @watch('activeTab')
  onActiveTabChanged(): void {
    void this.loadPageData();
  }

  @bound
  async retryLoad(): Promise<void> {
    this.isLoading = true;
    await this.loadPageData();
  }

  private async loadPageData(): Promise<void> {
    this.loadError = null;
    try {
      await this.fetchSettings();
      if (this.activeTab === SecurityTab.DASHBOARD) {
        await this.fetchStats();
      }
    } catch (err: any) {
      this.settings = null;
      this.loadError = err?.message || AdminI18n.t('settings.security.theSecuritySettingsRequestFailed');
    } finally {
      this.isLoading = false;
    }
  }

  private async fetchSettings(): Promise<void> {
    this.loaded = await SecuritySettingsIo.load();
    this.settings = { ...this.loaded };
  }

  private async fetchStats(): Promise<void> {
    this.statsError = null;
    try {
      const data = await AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.STATS.SECURITY);
      this.stats = data;
    } catch (e: any) {
      // A blank Dashboard tab reads as "nothing to report". Say what actually happened instead.
      this.stats = null;
      this.statsError = e?.message || AdminI18n.t('settings.security.theSecurityStatisticsRequestFailed');
    }
  }

  @bound
  setSettings(update: SetStateAction<Record<string, string>>): void {
    const current = this.settings;
    if (!current) return;
    this.settings = update instanceof Function ? update(current) : update;
  }

  /** Whether anything differs from what the server last returned: the save bar's question. */
  private get isDirty(): boolean {
    const settings = this.settings;
    if (!settings) return false;
    return Object.keys({ ...settings, ...this.loaded }).some((key) => (settings[key] ?? '') !== (this.loaded[key] ?? ''));
  }

  @bound
  discardChanges(): void {
    this.settings = { ...this.loaded };
  }

  @bound
  showDashboardTab(): void {
    this.activeTab = SecurityTab.DASHBOARD;
  }

  @bound
  showSettingsTab(): void {
    this.activeTab = SecurityTab.SETTINGS;
  }

  @bound
  async handleSave(): Promise<void> {
    const addNotification = this.runtime.notify.addNotification;
    const settings = this.settings;
    // Fail closed: never PUT values that were not read back from the server. The Save control is not
    // rendered in this state, so this is the belt to the browser's braces.
    if (!settings) return;
    this.isSaving = true;
    try {
      await SecuritySettingsIo.save(settings, this.loaded);
      await this.fetchSettings();
      addNotification({ title: AdminI18n.t('settings.security.securityUpdated'), message: AdminI18n.t('settings.security.apiProtectionAndAccountDefense'), type: NotificationType.SUCCESS });
    } catch (err: any) {
      addNotification({
        title: AdminI18n.t('settings.security.updateFailed'),
        message: err?.message || AdminI18n.t('settings.security.failedToSaveSecurityConfiguration'),
        type: NotificationType.ERROR
      });
    } finally {
      this.isSaving = false;
    }
  }

  render(): ReactNode {
    if (this.isLoading) return <div className="p-12"><Loader label={AdminI18n.t('settings.security.loadingSecuritySettings')} /></div>;

    const theme = this.theme;
    const activeTab = this.activeTab;
    const settings = this.settings;

    return (
      <div className="flex flex-col h-full animate-in fade-in duration-500">
        <CompactPageHeader
          theme={theme}
          title={AdminI18n.t('settings.security.securityDefense')}
          subtitle={AdminI18n.t('settings.security.runtimeIsolationAndProtection')}
          actions={
            <Tabs value={activeTab === SecurityTab.DASHBOARD ? 'dashboard' : 'settings'} onChange={(id: string) => (id === 'dashboard' ? this.showDashboardTab() : this.showSettingsTab())}
              tabs={[...(this.canManagePlatform ? [{ id: 'dashboard', label: AdminI18n.t('settings.security.dashboard') }] : []), { id: 'settings', label: AdminI18n.t('settings.security.settings') }]} />
          }
        />

        {this.loadError && (
          <LoadErrorPanel
            title={AdminI18n.t('settings.security.securitySettingsCouldNotBe')}
            message={this.loadError}
            onRetry={this.retryLoad}
            isRetrying={this.isLoading}
          />
        )}

        <div className="py-6 w-full pb-24 fc-page-stack">
          {activeTab === SecurityTab.DASHBOARD && this.statsError && !this.loadError && (
            <LoadErrorPanel
              title={AdminI18n.t('settings.security.securityStatisticsCouldNotBe')}
              message={this.statsError}
              onRetry={this.retryLoad}
              isRetrying={this.isLoading}
            />
          )}

          {activeTab === SecurityTab.DASHBOARD && this.stats && (
            <SecurityDashboard stats={this.stats} settings={this.settings} onOpenSettings={this.showSettingsTab} />
          )}

          {activeTab === SecurityTab.SETTINGS && this.settingsOutOfScope && (
            <SiteScopePanel detail={AdminI18n.t('settings.security.passwordPolicyLoginProtectionRate')} />
          )}

          {activeTab === SecurityTab.SETTINGS && settings && !this.settingsOutOfScope && (
            <SecuritySettingsCards settings={settings} setSettings={this.setSettings} theme={theme} />
          )}
          {activeTab === SecurityTab.SETTINGS && settings && !this.settingsOutOfScope && (
            <SettingsSaveBar dirty={this.isDirty} saving={this.isSaving} onSave={this.handleSave} onDiscard={this.discardChanges} />
          )}
        </div>
      </div>
    );
  }
}

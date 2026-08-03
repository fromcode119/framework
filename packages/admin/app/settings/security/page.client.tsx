import { SecurityTab } from '@/app/settings/security/enums/security-tab.enum';
import { NotificationType } from '@/components/enums/notification-type.enum';
import type { ReactNode, SetStateAction } from 'react';
import { state, bound, watch } from '@fromcode119/reactor';
import { AdminComponent } from '@/components/view/admin-component.client';
import { Button } from '@/components/ui/view/button.client';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { Loader } from '@/components/ui/view/loader.client';
import { SecurityDashboard } from '@/app/settings/security/security-dashboard';
import { SecuritySettingsCards } from '@/app/settings/security/security-settings-cards';
import { CompactPageHeader } from '@/components/ui/view/compact-page-header.client';
import { AdminClass } from '@/lib/admin-class';

export class SecuritySettingsPage extends AdminComponent {
  @state isSaving = false;
  @state isLoading = true;
  @state activeTab: SecurityTab = SecurityTab.DASHBOARD;
  @state stats: any = null;
  @state settings: Record<string, any> = {
    two_factor_enabled: false,
    rate_limit_max: '100',
    rate_limit_window: '900000',
    auth_session_duration_minutes: '10080',
  };

  async componentDidMount(): Promise<void> {
    await this.loadPageData();
  }

  @watch('activeTab')
  onActiveTabChanged(): void {
    void this.loadPageData();
  }

  private async loadPageData(): Promise<void> {
    try {
      await this.fetchSettings();
      if (this.activeTab === SecurityTab.DASHBOARD) {
        await this.fetchStats();
      }
    } finally {
      this.isLoading = false;
    }
  }

  private async fetchSettings(): Promise<void> {
    const response = await AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.SETTINGS);
    const prev = this.settings;
    this.settings = {
      ...prev,
      two_factor_enabled: response.two_factor_enabled === 'true',
      rate_limit_max: response.rate_limit_max ?? prev.rate_limit_max,
      rate_limit_window: response.rate_limit_window ?? prev.rate_limit_window,
      auth_session_duration_minutes: response.auth_session_duration_minutes ?? prev.auth_session_duration_minutes,
    };
  }

  private async fetchStats(): Promise<void> {
    try {
      const data = await AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.STATS.SECURITY);
      this.stats = data;
    } catch (e) {
      console.error("Failed to fetch security stats", e);
    }
  }

  @bound
  setSettings(update: SetStateAction<Record<string, any>>): void {
    this.settings = typeof update === 'function'
      ? (update as (prev: Record<string, any>) => Record<string, any>)(this.settings)
      : update;
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
    this.isSaving = true;
    try {
      const settings = this.settings;
      await AdminApi.put(AdminConstants.ENDPOINTS.SYSTEM.SETTINGS, {
        two_factor_enabled: settings.two_factor_enabled ? 'true' : 'false',
        rate_limit_max: String(settings.rate_limit_max),
        rate_limit_window: String(settings.rate_limit_window),
        auth_session_duration_minutes: String(settings.auth_session_duration_minutes),
      });
      await this.fetchSettings();
      addNotification({ title: 'Security Updated', message: 'API protection and account defense synced.', type: NotificationType.SUCCESS });
    } catch (err: any) {
      addNotification({
        title: 'Update Failed',
        message: err?.message || 'Failed to save security configuration.',
        type: NotificationType.ERROR
      });
    } finally {
      this.isSaving = false;
    }
  }

  render(): ReactNode {
    if (this.isLoading) return <div className="p-12"><Loader label="Hardening Protocols..." /></div>;

    const theme = this.theme;
    const activeTab = this.activeTab;

    return (
      <div className="flex flex-col h-full animate-in fade-in duration-500">
        <CompactPageHeader
          theme={theme}
          icon={<FrameworkIcons.Shield size={18} strokeWidth={2} />}
          title="Security & Defense"
          subtitle="Runtime isolation and protection"
          actions={
            <>
              <div className={`flex gap-1 p-1 ${AdminClass.SURFACE} bg-slate-100 dark:bg-slate-900`}>
                <button
                  onClick={this.showDashboardTab}
                  className={`px-4 py-1.5 text-[10px] font-semibold tracking-wide rounded-lg transition-all ${activeTab === SecurityTab.DASHBOARD ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-sm shadow-indigo-500/10' : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'}`}
                >
                  Dashboard
                </button>
                <button
                  onClick={this.showSettingsTab}
                  className={`px-4 py-1.5 text-[10px] font-semibold tracking-wide rounded-lg transition-all ${activeTab === SecurityTab.SETTINGS ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-sm shadow-indigo-500/10' : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'}`}
                >
                  Settings
                </button>
              </div>
              {activeTab === SecurityTab.SETTINGS && (
                <Button
                  icon={<FrameworkIcons.Shield size={15} strokeWidth={2} />}
                  onClick={this.handleSave}
                  isLoading={this.isSaving}
                  className="h-9 px-4 rounded-lg font-semibold text-xs text-white"
                >
                  Update Security
                </Button>
              )}
            </>
          }
        />

        <div className="p-6 w-full space-y-8 pb-24">
          {activeTab === SecurityTab.DASHBOARD && this.stats && (
            <SecurityDashboard stats={this.stats} />
          )}

          {activeTab === SecurityTab.SETTINGS && (
            <SecuritySettingsCards settings={this.settings} setSettings={this.setSettings} theme={theme} />
          )}
        </div>
      </div>
    );
  }
}

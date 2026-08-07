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
import { LoadErrorPanel } from '@/components/ui/view/load-error-panel.client';
import { SecurityDashboard } from '@/app/settings/security/security-dashboard';
import { SecuritySettingsCards } from '@/app/settings/security/security-settings-cards';
import { SecuritySettingsIo } from '@/app/settings/security/security-settings-io';
import { CompactPageHeader } from '@/components/ui/view/compact-page-header.client';
import { AdminClass } from '@/lib/admin-class';

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
  @state loadError: string | null = null;

  async componentDidMount(): Promise<void> {
    await this.loadPageData();
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
      this.loadError = err?.message || 'The security settings request failed.';
    } finally {
      this.isLoading = false;
    }
  }

  private async fetchSettings(): Promise<void> {
    this.settings = await SecuritySettingsIo.load();
  }

  private async fetchStats(): Promise<void> {
    this.statsError = null;
    try {
      const data = await AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.STATS.SECURITY);
      this.stats = data;
    } catch (e: any) {
      // A blank Dashboard tab reads as "nothing to report". Say what actually happened instead.
      this.stats = null;
      this.statsError = e?.message || 'The security statistics request failed.';
    }
  }

  @bound
  setSettings(update: SetStateAction<Record<string, string>>): void {
    const current = this.settings;
    if (!current) return;
    this.settings = update instanceof Function ? update(current) : update;
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
      await SecuritySettingsIo.save(settings);
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
    if (this.isLoading) return <div className="p-12"><Loader label="Loading security settings..." /></div>;

    const theme = this.theme;
    const activeTab = this.activeTab;
    const settings = this.settings;

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
              {activeTab === SecurityTab.SETTINGS && settings && (
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

        {this.loadError && (
          <LoadErrorPanel
            title="Security settings could not be loaded"
            message={this.loadError}
            onRetry={this.retryLoad}
            isRetrying={this.isLoading}
          />
        )}

        <div className="p-6 w-full space-y-8 pb-24">
          {activeTab === SecurityTab.DASHBOARD && this.statsError && !this.loadError && (
            <LoadErrorPanel
              title="Security statistics could not be loaded"
              message={this.statsError}
              onRetry={this.retryLoad}
              isRetrying={this.isLoading}
            />
          )}

          {activeTab === SecurityTab.DASHBOARD && this.stats && (
            <SecurityDashboard stats={this.stats} />
          )}

          {activeTab === SecurityTab.SETTINGS && settings && (
            <SecuritySettingsCards settings={settings} setSettings={this.setSettings} theme={theme} />
          )}
        </div>
      </div>
    );
  }
}

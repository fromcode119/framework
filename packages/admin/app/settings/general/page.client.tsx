import type { ReactNode } from 'react';
import { Slot } from '@fromcode119/react';
import { Loader } from '@/components/ui/view/loader.client';
import { LoadErrorPanel } from '@/components/ui/view/load-error-panel.client';
import { CompactPageHeader } from '@/components/ui/view/compact-page-header.client';
import { SettingsSaveBar } from '@/components/ui/view/settings-save-bar.client';
import { GeneralBrandCard } from '@/app/settings/general/general-brand-card';
import { GeneralSystemCards } from '@/app/settings/general/general-system-cards';
import { GeneralSignupEmailCard } from '@/app/settings/general/general-signup-email-card';
import { GeneralUsageReportCard } from '@/app/settings/general/general-usage-report-card';
import { PlatformSettingLocks } from '@/lib/settings/platform-setting-locks';
import { TenantScopeClient } from '@/lib/tenants/tenant-scope-client';
import { GeneralSettingsPageActions } from '@/app/settings/general/page-actions.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * Settings — General.
 *
 * The top of the chain: the lifecycle and the markup. What the page knows and what it can do live in
 * the links below — see `GeneralSettingsPageState`.
 */
export class GeneralSettingsPage extends GeneralSettingsPageActions {
  async componentDidMount(): Promise<void> {
    await this.loadSettings();
    const [locks, hostLocksSite] = await Promise.all([PlatformSettingLocks.load(), TenantScopeClient.hostLocksSite()]);
    this.platformLocks = locks;
    this.hostLocksSite = hostLocksSite;
  }

  /**
   * One line naming where the OTHER scope's settings live.
   *
   * Scope decides which settings this screen shows, so without this the hidden half would simply be
   * gone — an operator could not discover that `timezone` exists, let alone where to set it. Renders
   * nothing on a single-tenant deployment, where nothing is hidden.
   */
  protected renderScopeNotice(): ReactNode {
    const notice = this.platformLocks.hiddenScopeNotice(this.canManagePlatform);
    if (!notice) return null;
    const offerSwitch = this.platformLocks.isSiteScope() && this.canManagePlatform;
    return (
      <div className="fc-scope-notice">
        <span className="fc-scope-notice__text">{notice}</span>
        {offerSwitch && this.hostLocksSite ? (
          <span className="fc-scope-notice__text">{AdminI18n.t('shell.site.locked')}</span>
        ) : offerSwitch ? (
          <button type="button" className="fc-scope-notice__go" onClick={this.openPlatformScope}>{AdminI18n.t('ui.scopeGate.open')}</button>
        ) : null}
      </div>
    );
  }

  render(): ReactNode {
    if (this.isLoading) return <div className="p-12"><Loader label={AdminI18n.t('settings.general.loadingGeneralSettings')} /></div>;

    const theme = this.theme;
    const settings = this.settings;

    return (
      <div className="flex flex-col h-full animate-in fade-in duration-500">
        <CompactPageHeader
          theme={theme}
          title={AdminI18n.t('settings.general.generalConfiguration')}
          subtitle={AdminI18n.t('settings.general.brandIdentitySystemPreferences')}
        />

        {this.renderScopeNotice()}

        {this.loadError && (
          <LoadErrorPanel
            title={AdminI18n.t('settings.general.generalSettingsCouldNotBe')}
            message={this.loadError}
            onRetry={this.retryLoad}
            isRetrying={this.isLoading}
          />
        )}

        {settings && (
          <div className="p-6 w-full space-y-3">
            <GeneralBrandCard
              platformLocks={this.platformLocks}
              settings={settings}
              setSettings={this.setSettings}
              theme={theme}
              toggleTheme={this.runtime.toggleTheme}
            />

            <GeneralSystemCards
              platformLocks={this.platformLocks}
              settings={settings}
              setSettings={this.setSettings}
              theme={theme}
              timezoneOptions={this.timezoneOptions}
              isSendingTelemetryTest={this.isSendingTelemetryTest}
              onSendTelemetryTest={this.handleSendTelemetryTest}
            />

            <GeneralSignupEmailCard
              platformLocks={this.platformLocks}
              settings={settings}
              setSettings={this.setSettings}
              theme={theme}
            />

            <GeneralUsageReportCard
              platformLocks={this.platformLocks}
              settings={settings}
              setSettings={this.setSettings}
            />

            <Slot name="admin.settings.general.bottom" />
            <SettingsSaveBar dirty={this.isDirty} saving={this.isSaving} onSave={this.handleSave} onDiscard={this.discardChanges} />
          </div>
        )}
      </div>
    );
  }
}

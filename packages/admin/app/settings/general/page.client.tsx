import type { ReactNode } from 'react';
import { Slot } from '@fromcode119/react';
import { Button } from '@/components/ui/view/button.client';
import { FrameworkIcons } from '@fromcode119/react';
import { Loader } from '@/components/ui/view/loader.client';
import { LoadErrorPanel } from '@/components/ui/view/load-error-panel.client';
import { CompactPageHeader } from '@/components/ui/view/compact-page-header.client';
import { GeneralBrandCard } from '@/app/settings/general/general-brand-card';
import { GeneralSystemCards } from '@/app/settings/general/general-system-cards';
import { PlatformSettingLocks } from '@/lib/settings/platform-setting-locks';
import { GeneralSettingsPageActions } from '@/app/settings/general/page-actions.client';

/**
 * Settings — General.
 *
 * The top of the chain: the lifecycle and the markup. What the page knows and what it can do live in
 * the links below — see `GeneralSettingsPageState`.
 */
export class GeneralSettingsPage extends GeneralSettingsPageActions {
  async componentDidMount(): Promise<void> {
    await this.loadSettings();
    this.platformLocks = await PlatformSettingLocks.load();
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
        {offerSwitch ? (
          <Button
            onClick={this.openPlatformScope}
            icon={<FrameworkIcons.Globe size={13} strokeWidth={2} />}
            className="h-8 px-3 rounded-lg text-[11px] font-bold uppercase tracking-tight flex-shrink-0"
          >
            Open Platform Scope
          </Button>
        ) : null}
      </div>
    );
  }

  render(): ReactNode {
    if (this.isLoading) return <div className="p-12"><Loader label="Loading general settings..." /></div>;

    const theme = this.theme;
    const settings = this.settings;

    return (
      <div className="flex flex-col h-full animate-in fade-in duration-500">
        <CompactPageHeader
          theme={theme}
          icon={<FrameworkIcons.Settings size={18} strokeWidth={2} />}
          title="General Configuration"
          subtitle="Brand identity & system preferences"
          actions={
            settings ? (
              <Button
                icon={<FrameworkIcons.Save size={15} strokeWidth={2} />}
                onClick={this.handleSave}
                isLoading={this.isSaving}
                className="h-9 px-4 rounded-lg font-semibold text-xs text-white"
              >
                Save Changes
              </Button>
            ) : null
          }
        />

        {this.renderScopeNotice()}

        {this.loadError && (
          <LoadErrorPanel
            title="General settings could not be loaded"
            message={this.loadError}
            onRetry={this.retryLoad}
            isRetrying={this.isLoading}
          />
        )}

        {settings && (
          <div className="p-6 w-full space-y-8">
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

            <Slot name="admin.settings.general.bottom" />
          </div>
        )}
      </div>
    );
  }
}

import type { ReactNode } from 'react';
import { Button } from '@/components/ui/view/button.client';
import { FrameworkIcons } from '@fromcode119/react';
import { Loader } from '@/components/ui/view/loader.client';
import { LoadErrorPanel } from '@/components/ui/view/load-error-panel.client';
import { LocaleRegistryCard } from '@/app/settings/localization/locale-registry-card';
import { LocaleTargetsCard } from '@/app/settings/localization/locale-targets-card';
import { MeasurementSystemCard } from '@/app/settings/localization/measurement-system-card';
import { CompactPageHeader } from '@/components/ui/view/compact-page-header.client';
import { PlatformSettingLocks } from '@/lib/settings/platform-setting-locks';
import { SettingsPageScope } from '@/lib/settings/settings-page-scope';
import { SiteScopePanel } from '@/components/view/site-scope-panel.client';
import { LocalizationSettingsPageActions } from '@/app/settings/localization/page-actions.client';
import { LocalizationSettingsPageState } from '@/app/settings/localization/page-state.client';

/**
 * Settings — Localization.
 *
 * The top of the chain: the lifecycle and the markup. What the page knows and what it can do live in
 * the links below — see `LocalizationSettingsPageState`.
 */
export class LocalizationSettingsPage extends LocalizationSettingsPageActions {
  async componentDidMount(): Promise<void> {
    await this.loadLocalization();
    this.scope = new SettingsPageScope(await PlatformSettingLocks.load(), LocalizationSettingsPageState.KEYS);
  }

  render(): ReactNode {
    if (this.isLoading) {
      return (
        <div className="p-12">
          <Loader label="Loading localization settings..." />
        </div>
      );
    }

    const theme = this.theme;
    const locales = this.locales;

    if (!locales) {
      return (
        <div className="flex flex-col h-full animate-in fade-in duration-500">
          <CompactPageHeader
            theme={theme}
            icon={<FrameworkIcons.Globe size={18} strokeWidth={2} />}
            title="Localization"
            subtitle="Locale registry & language defaults"
          />
          <LoadErrorPanel
            title="Localization settings could not be loaded"
            message={this.loadError || 'The localization settings request failed.'}
            onRetry={this.retryLoad}
            isRetrying={this.isLoading}
          />
        </div>
      );
    }

    return (
      <div className="flex flex-col h-full animate-in fade-in duration-500">
        <CompactPageHeader
          theme={theme}
          icon={<FrameworkIcons.Globe size={18} strokeWidth={2} />}
          title="Localization"
          subtitle="Locale registry & language defaults"
          actions={
            this.outOfScope ? null : (
              <Button
                icon={<FrameworkIcons.Save size={15} strokeWidth={2} />}
                onClick={this.handleSave}
                isLoading={this.isSaving}
                className="h-9 px-4 rounded-lg font-semibold text-xs text-white"
              >
                Save Localization
              </Button>
            )
          }
        />

        {this.outOfScope && (
          <SiteScopePanel detail="Locales, language defaults and the measurement system are stored per site. Choose a site from the site menu to configure them." />
        )}

        {!this.outOfScope && (
        <div className="p-6 w-full space-y-8">
          <LocaleRegistryCard
            locales={locales}
            theme={theme}
            updateLocale={this.updateLocale}
            addLocale={this.addLocale}
            removeLocale={this.removeLocale}
          />

          <LocaleTargetsCard
            theme={theme}
            localeSelectOptions={this.localeSelectOptions}
            defaultLocale={this.defaultLocale}
            setDefaultLocale={this.setDefaultLocale}
            adminDefaultLocale={this.adminDefaultLocale}
            setAdminDefaultLocale={this.setAdminDefaultLocale}
            frontendDefaultLocale={this.frontendDefaultLocale}
            setFrontendDefaultLocale={this.setFrontendDefaultLocale}
            localeUrlStrategy={this.localeUrlStrategy}
            setLocaleUrlStrategy={this.setLocaleUrlStrategy}
          />

          <MeasurementSystemCard
            theme={theme}
            measurementSystem={this.measurementSystem}
            setMeasurementSystem={this.setMeasurementSystem}
          />
        </div>
        )}
      </div>
    );
  }
}

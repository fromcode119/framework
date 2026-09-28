import { MeasurementSystem, PlatformCountryUtils } from '@fromcode119/core/client';
import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';

import { PureReactor, prop, bound } from '@fromcode119/react-class-components';
import { Card } from '@/components/ui/view/card.client';
import { Select } from '@/components/ui/view/select.client';
import { FrameworkIcons } from '@fromcode119/react';
import { SettingRow } from '@/app/settings/localization/setting-row';
import { CountryCatalog } from '@/components/collection/fields/country-catalog';
import { PlatformCountryDescription } from '@/lib/settings/platform-country-description';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * The site's region: its COUNTRY and its measurement system (metric / imperial). Both are regional
 * formats like locale — domain plugins read them; the framework holds no country's rules.
 *
 * The country is the ONE value every country-aware module inherits (invoicing, tax, payroll); a module
 * overrides it only for itself. Blank derives it from the frontend language, and the row says the
 * result, live, as the languages above are edited.
 */
export class MeasurementSystemCard extends PureReactor {
  @prop declare theme: ThemeMode;
  @prop declare measurementSystem: MeasurementSystem;
  @prop declare setMeasurementSystem: (value: MeasurementSystem) => void;
  @prop declare country: string;
  @prop declare setCountry: (value: string) => void;
  @prop declare frontendDefaultLocale: string;
  @prop declare defaultLocale: string;

  /** What the saved form would resolve to — computed from the unsaved values on this page. */
  protected get countryInEffect(): string {
    return PlatformCountryDescription.describe(PlatformCountryUtils.resolve({
      [PlatformCountryUtils.SETTING_KEY]: this.country,
      frontend_default_locale: this.frontendDefaultLocale,
      default_locale: this.defaultLocale,
    }));
  }

  @bound
  protected onMeasurementSystemChange(value: string): void {
    this.setMeasurementSystem(MeasurementSystem.resolve(value));
  }

  render(): ReactNode {
    return (
      <Card title={AdminI18n.t('settings.localization.regionUnits')}>
        <SettingRow
          theme={this.theme}
          icon={FrameworkIcons.Globe}
          title={AdminI18n.t('settings.localization.country')}
          description={AdminI18n.t('settings.localization.theCountryThisSiteOperates', { countryInEffect: this.countryInEffect })}
        >
          <Select
            value={this.country}
            onChange={this.setCountry}
            options={[{ value: '', label: AdminI18n.t('settings.localization.fromTheFrontendLanguage') }, ...CountryCatalog.options()]}
            placeholder={AdminI18n.t('settings.localization.selectCountry')}
            searchable
            theme={this.theme}
            className="w-full md:w-64"
          />
        </SettingRow>
        <SettingRow
          theme={this.theme}
          icon={FrameworkIcons.Globe}
          title={AdminI18n.t('settings.localization.measurementSystem')}
          description={AdminI18n.t('settings.localization.unitsUsedAcrossThePlatform')}
        >
          <Select
            value={this.measurementSystem.value}
            onChange={this.onMeasurementSystemChange}
            options={[
              { value: 'metric', label: AdminI18n.t('settings.localization.metricCmKg') },
              { value: 'imperial', label: AdminI18n.t('settings.localization.imperialInLb') }
            ]}
            placeholder={AdminI18n.t('settings.localization.selectMeasurementSystem')}
            searchable={false}
            theme={this.theme}
            className="w-full md:w-64"
          />
        </SettingRow>
      </Card>
    );
  }
}

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
      <Card title="Region & Units">
        <SettingRow
          theme={this.theme}
          icon={FrameworkIcons.Globe}
          title="Country"
          description={`The country this site operates in. Invoicing, tax and payroll modules follow it unless one overrides it in its own settings. Leave blank to derive it from the frontend language. In effect: ${this.countryInEffect}.`}
        >
          <Select
            value={this.country}
            onChange={this.setCountry}
            options={[{ value: '', label: 'From the frontend language' }, ...CountryCatalog.OPTIONS]}
            placeholder="Select country"
            searchable
            theme={this.theme}
            className="w-full md:w-64"
          />
        </SettingRow>
        <SettingRow
          theme={this.theme}
          icon={FrameworkIcons.Globe}
          title="Measurement System"
          description="Units used across the platform for physical dimensions and weight (e.g. product packages). Metric = cm/kg, Imperial = in/lb."
        >
          <Select
            value={this.measurementSystem.value}
            onChange={this.onMeasurementSystemChange}
            options={[
              { value: 'metric', label: 'Metric (cm / kg)' },
              { value: 'imperial', label: 'Imperial (in / lb)' }
            ]}
            placeholder="Select measurement system"
            searchable={false}
            theme={this.theme}
            className="w-full md:w-64"
          />
        </SettingRow>
      </Card>
    );
  }
}

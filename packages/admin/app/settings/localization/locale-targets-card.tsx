import { ThemeMode } from '@fromcode119/core/client';
import type { Dispatch, ReactNode, SetStateAction } from 'react';

import { PureReactor, prop, bound } from '@fromcode119/reactor';
import { Card } from '@/components/ui/view/card.client';
import { Select } from '@/components/ui/view/select.client';
import { FrameworkIcons } from '@fromcode119/react';
import { SettingRow } from '@/app/settings/localization/setting-row';
import { LocaleUrlStrategy } from '@fromcode119/core/client';

export class LocaleTargetsCard extends PureReactor {
  @prop declare theme: ThemeMode;
  @prop declare localeSelectOptions: { value: string; label: string }[];
  @prop declare defaultLocale: string;
  @prop declare setDefaultLocale: (value: string) => void;
  @prop declare adminDefaultLocale: string;
  @prop declare setAdminDefaultLocale: (value: string) => void;
  @prop declare frontendDefaultLocale: string;
  @prop declare setFrontendDefaultLocale: (value: string) => void;
  @prop declare localeUrlStrategy: LocaleUrlStrategy;
  @prop declare setLocaleUrlStrategy: Dispatch<SetStateAction<LocaleUrlStrategy>>;

  @bound
  protected onLocaleUrlStrategyChange(value: string): void {
    this.setLocaleUrlStrategy(LocaleUrlStrategy.resolve(value));
  }

  render(): ReactNode {
    return (
      <Card title="Default Locale Targets">
        <SettingRow
          theme={this.theme}
          icon={FrameworkIcons.Globe}
          title="System Default Locale"
          description="Primary locale used by system-level fallback logic."
        >
          <Select
            value={this.defaultLocale}
            onChange={this.setDefaultLocale}
            options={this.localeSelectOptions}
            placeholder="Select system locale"
            searchable={false}
            theme={this.theme}
            className="w-full md:w-64"
          />
        </SettingRow>

        <SettingRow
          theme={this.theme}
          icon={FrameworkIcons.Settings}
          title="Admin Default Locale"
          description="Default language used by the framework admin interface."
        >
          <Select
            value={this.adminDefaultLocale}
            onChange={this.setAdminDefaultLocale}
            options={this.localeSelectOptions}
            placeholder="Select admin locale"
            searchable={false}
            theme={this.theme}
            className="w-full md:w-64"
          />
        </SettingRow>

        <SettingRow
          theme={this.theme}
          icon={FrameworkIcons.Layout}
          title="Frontend Default Locale"
          description="Default language used by frontend rendering/runtime fallback."
        >
          <Select
            value={this.frontendDefaultLocale}
            onChange={this.setFrontendDefaultLocale}
            options={this.localeSelectOptions}
            placeholder="Select frontend locale"
            searchable={false}
            theme={this.theme}
            className="w-full md:w-64"
          />
        </SettingRow>

        <SettingRow
          theme={this.theme}
          icon={FrameworkIcons.Globe}
          title="Locale URL Strategy"
          description='Choose locale routing style: `?locale=bg`, `/bg/...`, or locale hidden in URL.'
        >
          <Select
            value={this.localeUrlStrategy.value}
            onChange={this.onLocaleUrlStrategyChange}
            options={[
              { value: 'query', label: 'Query Parameter (?locale=bg)' },
              { value: 'path', label: 'Path Prefix (/bg/...)' },
              { value: 'none', label: 'No Locale in URL' }
            ]}
            placeholder="Select locale URL strategy"
            searchable={false}
            theme={this.theme}
            className="w-full md:w-64"
          />
        </SettingRow>
      </Card>
    );
  }
}

import { ThemeMode } from '@fromcode119/core/client';
import type { Dispatch, ReactNode, SetStateAction } from 'react';

import { PureReactor, prop, bound } from '@fromcode119/react-class-components';
import { Card } from '@/components/ui/view/card.client';
import { Select } from '@/components/ui/view/select.client';
import { FrameworkIcons } from '@fromcode119/react';
import { SettingRow } from '@/app/settings/localization/setting-row';
import { LocaleUrlStrategy } from '@fromcode119/core/client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

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
      <Card title={AdminI18n.t('settings.localization.defaultLocaleTargets')}>
        <SettingRow
          theme={this.theme}
          icon={FrameworkIcons.Globe}
          title={AdminI18n.t('settings.localization.systemDefaultLocale')}
          description={AdminI18n.t('settings.localization.primaryLocaleUsedBySystem')}
        >
          <Select
            value={this.defaultLocale}
            onChange={this.setDefaultLocale}
            options={this.localeSelectOptions}
            placeholder={AdminI18n.t('settings.localization.selectSystemLocale')}
            searchable={false}
            theme={this.theme}
            className="w-full md:w-64"
          />
        </SettingRow>

        <SettingRow
          theme={this.theme}
          icon={FrameworkIcons.Settings}
          title={AdminI18n.t('settings.localization.adminDefaultLocale')}
          description={AdminI18n.t('settings.localization.defaultLanguageUsedByThe')}
        >
          <Select
            value={this.adminDefaultLocale}
            onChange={this.setAdminDefaultLocale}
            options={this.localeSelectOptions}
            placeholder={AdminI18n.t('settings.localization.selectAdminLocale')}
            searchable={false}
            theme={this.theme}
            className="w-full md:w-64"
          />
        </SettingRow>

        <SettingRow
          theme={this.theme}
          icon={FrameworkIcons.Layout}
          title={AdminI18n.t('settings.localization.frontendDefaultLocale')}
          description={AdminI18n.t('settings.localization.defaultLanguageUsedByFrontend')}
        >
          <Select
            value={this.frontendDefaultLocale}
            onChange={this.setFrontendDefaultLocale}
            options={this.localeSelectOptions}
            placeholder={AdminI18n.t('settings.localization.selectFrontendLocale')}
            searchable={false}
            theme={this.theme}
            className="w-full md:w-64"
          />
        </SettingRow>

        <SettingRow
          theme={this.theme}
          icon={FrameworkIcons.Globe}
          title={AdminI18n.t('settings.localization.localeUrlStrategy')}
          description={AdminI18n.t('settings.localization.chooseLocaleRoutingStyleLocale')}
        >
          <Select
            value={this.localeUrlStrategy.value}
            onChange={this.onLocaleUrlStrategyChange}
            options={[
              { value: 'query', label: AdminI18n.t('settings.localization.queryParameterLocaleBg') },
              { value: 'path', label: AdminI18n.t('settings.localization.pathPrefixBg') },
              { value: 'none', label: AdminI18n.t('settings.localization.noLocaleInUrl') }
            ]}
            placeholder={AdminI18n.t('settings.localization.selectLocaleUrlStrategy')}
            searchable={false}
            theme={this.theme}
            className="w-full md:w-64"
          />
        </SettingRow>
      </Card>
    );
  }
}

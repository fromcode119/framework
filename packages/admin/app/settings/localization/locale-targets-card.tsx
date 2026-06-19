import React from 'react';
import { Card } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { FrameworkIcons } from '@fromcode119/react';
import { SettingRow } from './setting-row';
import type { LocaleUrlStrategy } from './localization.types';
import type { LocaleTargetsCardProps } from './locale-targets-card.interfaces';

export class LocaleTargetsCard extends React.Component<LocaleTargetsCardProps> {
  render(): React.ReactNode {
    const {
      theme,
      localeSelectOptions,
      defaultLocale,
      setDefaultLocale,
      adminDefaultLocale,
      setAdminDefaultLocale,
      frontendDefaultLocale,
      setFrontendDefaultLocale,
      localeUrlStrategy,
      setLocaleUrlStrategy,
    } = this.props;
    return (
      <Card title="Default Locale Targets">
        <SettingRow
          theme={theme}
          icon={FrameworkIcons.Globe}
          title="System Default Locale"
          description="Primary locale used by system-level fallback logic."
        >
          <Select
            value={defaultLocale}
            onChange={setDefaultLocale}
            options={localeSelectOptions}
            placeholder="Select system locale"
            searchable={false}
            theme={theme}
            className="w-full md:w-64"
          />
        </SettingRow>

        <SettingRow
          theme={theme}
          icon={FrameworkIcons.Settings}
          title="Admin Default Locale"
          description="Default language used by the framework admin interface."
        >
          <Select
            value={adminDefaultLocale}
            onChange={setAdminDefaultLocale}
            options={localeSelectOptions}
            placeholder="Select admin locale"
            searchable={false}
            theme={theme}
            className="w-full md:w-64"
          />
        </SettingRow>

        <SettingRow
          theme={theme}
          icon={FrameworkIcons.Layout}
          title="Frontend Default Locale"
          description="Default language used by frontend rendering/runtime fallback."
        >
          <Select
            value={frontendDefaultLocale}
            onChange={setFrontendDefaultLocale}
            options={localeSelectOptions}
            placeholder="Select frontend locale"
            searchable={false}
            theme={theme}
            className="w-full md:w-64"
          />
        </SettingRow>

        <SettingRow
          theme={theme}
          icon={FrameworkIcons.Globe}
          title="Locale URL Strategy"
          description='Choose locale routing style: `?locale=bg`, `/bg/...`, or locale hidden in URL.'
        >
          <Select
            value={localeUrlStrategy}
            onChange={(value) => setLocaleUrlStrategy((value as LocaleUrlStrategy) || 'query')}
            options={[
              { value: 'query', label: 'Query Parameter (?locale=bg)' },
              { value: 'path', label: 'Path Prefix (/bg/...)' },
              { value: 'none', label: 'No Locale in URL' }
            ]}
            placeholder="Select locale URL strategy"
            searchable={false}
            theme={theme}
            className="w-full md:w-64"
          />
        </SettingRow>
      </Card>
    );
  }
}

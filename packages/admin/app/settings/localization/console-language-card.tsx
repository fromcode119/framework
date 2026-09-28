import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';

import { PureReactor, prop } from '@fromcode119/react-class-components';
import { Card } from '@/components/ui/view/card.client';
import { Select } from '@/components/ui/view/select.client';
import { FrameworkIcons } from '@fromcode119/react';
import { SettingRow } from '@/app/settings/localization/setting-row';
import { AdminDictionary } from '@/lib/i18n/admin-dictionary';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * The platform's own console language — what the console speaks with no site selected, and what
 * every site that has not chosen its own inherits.
 *
 * The choices are the languages the console HAS words for, each named in itself, not a site's
 * content locales: the platform has no locale registry, and a language with no dictionary would only
 * ever show English.
 */
export class ConsoleLanguageCard extends PureReactor {
  @prop declare theme: ThemeMode;
  @prop declare value: string;
  @prop declare onChange: (value: string) => void;

  private get options(): { value: string; label: string }[] {
    return AdminDictionary.locales.map((code) => ({ value: code, label: AdminDictionary.label(code) }));
  }

  render(): ReactNode {
    return (
      <Card title={AdminI18n.t('settings.localization.consoleLanguage')}>
        <SettingRow
          theme={this.theme}
          icon={FrameworkIcons.Settings}
          title={AdminI18n.t('settings.localization.adminDefaultLocale')}
          description={AdminI18n.t('settings.localization.platformConsoleLanguageHint')}
        >
          <Select
            value={this.value}
            onChange={this.onChange}
            options={this.options}
            placeholder={AdminI18n.t('settings.localization.selectAdminLocale')}
            searchable={false}
            theme={this.theme}
            className="w-full md:w-64"
          />
        </SettingRow>
      </Card>
    );
  }
}

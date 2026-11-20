import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';

import { PureReactor, prop } from '@fromcode119/react-class-components';
import { ListShell } from '@/components/ui/view/list-shell.client';
import { DataTable } from '@/components/ui/view/data-table.client';
import { EmptyState } from '@/components/ui/view/empty-state.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { Button } from '@/components/ui/view/button.client';
import { Input } from '@/components/ui/view/input.client';
import { Select } from '@/components/ui/view/select.client';
import { LanguageCatalog } from '@/components/collection/fields/language-catalog';
import { Switch } from '@/components/ui/view/switch.client';
import { FrameworkIcons } from '@fromcode119/react';
import { ILocaleItem } from '@/app/settings/localization/interfaces/locale-item.interface';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

export class LocaleRegistryCard extends PureReactor {
  @prop declare locales: ILocaleItem[];
  @prop declare theme: ThemeMode;
  @prop declare updateLocale: (id: string, patch: Partial<ILocaleItem>) => void;
  @prop declare addLocale: () => void;
  @prop declare removeLocale: (id: string) => void;

  private pickLanguage(locale: ILocaleItem, code: string): void {
    this.updateLocale(locale.id, locale.name.trim() ? { code } : { code, name: LanguageCatalog.ownName(code) });
  }

  private get columns(): any[] {
    const { locales, theme, updateLocale } = this;
    return [
      // Which language: picked from the standard list, never typed, so a code the storefront cannot
      // resolve ("bulgarian", "BG ") is not possible.
      { header: AdminI18n.t('settings.localization.pickLanguage'), id: 'code', accessor: (locale: ILocaleItem) => (
        <Select value={locale.code} onChange={(code: string) => this.pickLanguage(locale, code)} options={LanguageCatalog.options(locales.map((item) => item.code))}
          placeholder={AdminI18n.t('settings.localization.pickLanguage')} searchable theme={theme} />
      ) },
      // The name visitors read in the language switcher; filled from the language when empty, and the
      // operator's to change.
      { header: AdminI18n.t('settings.localization.languageNameEGEnglish'), id: 'name', className: 'fc-dt-fill', accessor: (locale: ILocaleItem) => (
        <Input value={locale.name} onChange={(e) => updateLocale(locale.id, { name: e.target.value })} placeholder={AdminI18n.t('settings.localization.languageNameEGEnglish')} />
      ) },
      { header: AdminI18n.t('settings.localization.enabled'), id: 'enabled', accessor: (locale: ILocaleItem) => (
        <Switch checked={locale.enabled} onChange={(value) => updateLocale(locale.id, { enabled: value })} />
      ) },
    ];
  }

  render(): ReactNode {
    const { locales, removeLocale } = this;
    return (
      <ListShell
        title={AdminI18n.t('settings.localization.localeRegistry')}
        count={locales.length}
        subtitle={AdminI18n.t('settings.localization.defineLanguageNameIsoCode')}
        actions={<Button variant={ButtonVariant.SECONDARY} icon={<FrameworkIcons.Plus size={15} />} onClick={this.addLocale}>{AdminI18n.t('settings.localization.addLocale')}</Button>}
      >
        {/* An empty registry says so. It used to be impossible to see: the page seeded a hardcoded
            English row, so "nothing configured" was indistinguishable from "English configured". */}
        {locales.length === 0 ? (
          <EmptyState title={AdminI18n.t('settings.localization.noLocalesConfiguredAddOne')} />
        ) : (
          <DataTable
            columns={this.columns}
            data={locales as any}
            actions={(locale: ILocaleItem) => (
              // The last language cannot be removed: a site with none has nothing to show.
              <Button variant={ButtonVariant.GHOST} disabled={locales.length <= 1} icon={<FrameworkIcons.Trash size={15} />} onClick={() => removeLocale(locale.id)}>{AdminI18n.t('settings.localization.remove')}</Button>
            )}
          />
        )}
      </ListShell>
    );
  }
}

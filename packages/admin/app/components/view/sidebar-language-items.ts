import type { IDropdownItem } from '@/components/ui/interfaces/dropdown-item.interface';
import { AdminConsoleLanguage } from '@/lib/i18n/admin-console-language';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * The "Language" group of the account menu: the site's default first, then each language the site has
 * enabled. It sets only the reader's own console language — the site default stays the operators'
 * decision in Settings → Localization.
 */
export class SidebarLanguageItems {
  static build(input: { personal: string; defaultLocale: string; locales: Array<{ code: string; label: string }> }): IDropdownItem[] {
    if (input.locales.length < 2) return [];
    const defaultLabel = input.locales.find((locale) => locale.code === input.defaultLocale)?.label || '';
    const siteDefault: IDropdownItem = {
      label: defaultLabel
        ? AdminI18n.t('shell.account.languageSiteDefault', { language: defaultLabel })
        : AdminI18n.t('shell.account.languageSiteDefaultNone'),
      selectable: true,
      selected: !input.personal,
      onClick: () => { if (input.personal) void AdminConsoleLanguage.choose(''); },
    };
    const choices = input.locales.map((locale): IDropdownItem => ({
      // The label is the language's own name; its code under it made these rows twice the height of
      // the site-default row beside them, so one radio group read as two.
      label: locale.label || locale.code.toUpperCase(),
      selectable: true,
      selected: input.personal === locale.code,
      onClick: () => { if (input.personal !== locale.code) void AdminConsoleLanguage.choose(locale.code); },
    }));
    return [siteDefault, ...choices].map((item, index) => ({ ...item, section: index === 0 ? AdminI18n.t('shell.account.language') : undefined }));
  }
}

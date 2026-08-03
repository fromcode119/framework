import { ILocaleItem } from '@/app/settings/localization/interfaces/locale-item.interface';
import { LocaleUrlStrategy } from '@fromcode119/core/client';

export interface ILoadedLocalization {
  locales: ILocaleItem[];
  defaultLocale: string;
  adminDefaultLocale: string;
  frontendDefaultLocale: string;
  localeUrlStrategy: LocaleUrlStrategy;
}

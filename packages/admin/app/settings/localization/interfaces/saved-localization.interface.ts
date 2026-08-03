import { ILocaleItem } from '@/app/settings/localization/interfaces/locale-item.interface';

export interface ISavedLocalization {
  cleaned: ILocaleItem[];
  enabledCodes: string[];
  defaultLocale: string;
  adminDefaultLocale: string;
  frontendDefaultLocale: string;
}

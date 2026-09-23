import { ILocaleItem } from '@/app/settings/localization/interfaces/locale-item.interface';
import { LocaleUrlStrategy, MeasurementSystem } from '@fromcode119/core/client';

export interface ILoadedLocalization {
  locales: ILocaleItem[];
  defaultLocale: string;
  adminDefaultLocale: string;
  frontendDefaultLocale: string;
  localeUrlStrategy: LocaleUrlStrategy;
  measurementSystem: MeasurementSystem;
  /** The stored platform country (ISO alpha-2), '' when not set. */
  country: string;
}

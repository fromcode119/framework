import type React from 'react';
import type { LocaleUrlStrategy } from './localization.types';

export interface LocaleTargetsCardProps {
  theme: string;
  localeSelectOptions: { value: string; label: string }[];
  defaultLocale: string;
  setDefaultLocale: (value: string) => void;
  adminDefaultLocale: string;
  setAdminDefaultLocale: (value: string) => void;
  frontendDefaultLocale: string;
  setFrontendDefaultLocale: (value: string) => void;
  localeUrlStrategy: LocaleUrlStrategy;
  setLocaleUrlStrategy: React.Dispatch<React.SetStateAction<LocaleUrlStrategy>>;
}

import type { LocaleItem } from './localization.types';

export interface LocaleRegistryCardProps {
  locales: LocaleItem[];
  theme: string;
  updateLocale: (id: string, patch: Partial<LocaleItem>) => void;
  addLocale: () => void;
  removeLocale: (id: string) => void;
}

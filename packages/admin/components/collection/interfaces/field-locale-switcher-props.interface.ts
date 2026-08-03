import { ThemeMode } from '@fromcode119/core/client';

export interface IFieldLocaleSwitcherProps {
  compact?: boolean;
  theme: ThemeMode;
  activeLocale: string;
  activeLocaleCode: string;
  localeRegistry: Array<{ code: string; label: string }>;
  isOpen: boolean;
  onToggle: () => void;
  onSelect: (code: string) => void;
  menuRef: React.RefObject<HTMLDivElement>;
}

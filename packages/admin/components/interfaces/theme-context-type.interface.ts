import { ThemeMode } from '@fromcode119/core/client';
export interface IThemeContextType {
  theme: ThemeMode;
  toggleTheme: () => void;
}

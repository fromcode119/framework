import type { ThemeStyleVariant } from './theme-style-variant.interfaces';

export interface ThemeRegistration {
  layouts?: Record<string, any>;
  styleVariants?: Record<string, ThemeStyleVariant>;
  variables?: Record<string, string>;
  overrides?: Record<string, any> | any[];
}

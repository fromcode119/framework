import type { IThemeStyleVariant } from '@sdk/types/interfaces/theme-style-variant.interface';

export interface IThemeRegistration {
  layouts?: Record<string, any>;
  styleVariants?: Record<string, IThemeStyleVariant>;
  variables?: Record<string, string>;
  overrides?: Record<string, any> | any[];
}

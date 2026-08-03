import type { IThemeLayoutReplacementDefinition } from '@core/layout/interfaces/theme-layout-replacement-definition.interface';
import type { IThemeLayoutDisableDefinition } from '@core/layout/interfaces/theme-layout-disable-definition.interface';

export interface IThemeLayoutOverrideRegistration {
  disables?: IThemeLayoutDisableDefinition[];
  replacements?: IThemeLayoutReplacementDefinition[];
  themeSlug: string;
}

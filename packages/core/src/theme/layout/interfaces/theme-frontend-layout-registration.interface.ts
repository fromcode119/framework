import type { IThemeLayoutDisableDefinition } from '@core/layout/interfaces/theme-layout-disable-definition.interface';
import type { IThemeLayoutReplacementDefinition } from '@core/layout/interfaces/theme-layout-replacement-definition.interface';

export interface IThemeFrontendLayoutRegistration {
  disables?: IThemeLayoutDisableDefinition[];
  replacements?: IThemeLayoutReplacementDefinition[];
  themeSlug: string;
}

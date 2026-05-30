import type {
  ThemeLayoutDisableDefinition,
  ThemeLayoutReplacementDefinition,
} from '../../types/layout/layout.interfaces';

export interface ThemeFrontendLayoutRegistrarOptions {
  themeSlug: string;
}

export interface ThemeFrontendLayoutRegistration {
  disables?: ThemeLayoutDisableDefinition[];
  replacements?: ThemeLayoutReplacementDefinition[];
  themeSlug: string;
}
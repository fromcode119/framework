import type {
  ThemeDesignDisableDefinition,
  ThemeDesignReplacementDefinition,
} from '../../types/default-design/default-design.interfaces';

export interface ThemeFrontendDefaultDesignRegistrarOptions {
  themeSlug: string;
}

export interface ThemeFrontendDefaultDesignRegistration {
  disables?: ThemeDesignDisableDefinition[];
  replacements?: ThemeDesignReplacementDefinition[];
  themeSlug: string;
}
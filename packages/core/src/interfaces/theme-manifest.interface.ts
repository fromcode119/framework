import { ThemeConfigFieldType } from '@core/enums/theme-config-field-type.enum';
import { ThemeSettingType } from '@core/enums/theme-setting-type.enum';
import { RuntimeModuleKind } from '@core/plugin/services/enums/runtime-module-kind.enum';

export interface IThemeManifest {
  slug: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  updateUrl?: string; // External URL to check for updates
  layouts: {
    name: string;
    label: string;
    description?: string;
  }[];
  slots?: string[]; // Defined slot names this theme provides
  overrides?: { name: string; component: string; priority?: number }[]; // Component overrides
  dependencies?: Record<string, string>; // Plugins required by this theme
  bundledPlugins?: string[]; // Relative paths to plugin .zip or .tar.gz archives bundled inside the theme package
  seeds?: string; // Path to seed file
  variables?: Record<string, string>;
  variableSchema?: Record<string, {
    label: string;
    type: ThemeSettingType;
    description?: string;
    options?: { label: string; value: string }[];
    group?: string;
  }>;
  settingsDefaults?: Record<string, any>;
  settingsSchema?: Record<string, {
    label: string;
    type: ThemeConfigFieldType;
    description?: string;
    options?: { label: string; value: string }[];
    group?: string;
    placeholder?: string;
    integrationType?: string;
  }>;
  integrationRequirements?: {
    type: string;
    label?: string;
    description?: string;
    required?: boolean;
  }[];
  runtimeModules?: Record<string, string | { keys?: string[], type?: RuntimeModuleKind, url?: string }>;
  ui?: {
    entry?: string;
    css?: string[];
  };
}

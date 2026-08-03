import type { ThemeConfigFieldType, ThemeSettingType } from '@fromcode119/core/client';
import { ThemeState } from '@fromcode119/core/client';

export interface ITheme {
  slug: string;
  name: string;
  version: string;
  description?: string;
  state: ThemeState;
  author?: string;
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
  layouts?: { name: string; label: string; description?: string }[];
  overrides?: { name: string; component: string; priority?: number }[];
}

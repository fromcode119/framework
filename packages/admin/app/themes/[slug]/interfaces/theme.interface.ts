import type { ThemeConfigFieldType, ThemeSettingType } from '@fromcode119/core/client';
import type { ThemeState } from '@fromcode119/core/client';

/**
 * An installed theme as the theme settings page consumes it — AFTER `ThemeRecordHydrator` has turned
 * the wire row into this shape. The enum-typed members (`state`, the two `type` fields) are plain
 * strings on the wire, so a raw API row is NOT an `ITheme`; only a hydrated one is.
 *
 * The `type` fields are OPTIONAL because a theme may declare a variable/setting without one — the
 * panels then infer the control from the value (a `#`-prefixed variable is a color, a boolean setting
 * is a switch). Declaring them required would have made that inference unreachable.
 */
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
    type?: ThemeSettingType;
    description?: string;
    options?: { label: string; value: string }[];
    group?: string;
  }>;
  settingsDefaults?: Record<string, unknown>;
  settingsSchema?: Record<string, {
    label: string;
    type?: ThemeConfigFieldType;
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

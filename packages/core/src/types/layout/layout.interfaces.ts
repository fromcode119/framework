import type {
  LayoutDiagnosticCode,
  LayoutDiagnosticSeverity,
  LayoutResolutionSource,
  LayoutResolutionStatus,
  LayoutTargetKind,
} from './layout.types';

export interface LayoutOwnerIdentity {
  namespace: string;
  pluginSlug: string;
  targetKey: string;
  targetKind: LayoutTargetKind;
}

export interface PluginLayoutDefinition extends LayoutOwnerIdentity {
  component: unknown;
  priority?: number;
  required?: boolean;
}

export interface PluginLayoutRegistration {
  namespace: string;
  pluginSlug: string;
  layouts: PluginLayoutDefinition[];
}

export interface RegisteredPluginLayoutDefinition extends LayoutOwnerIdentity {
  canonicalKey: string;
  component: unknown;
  priority: number;
  required: boolean;
}

export interface ThemeLayoutReplacementDefinition extends LayoutOwnerIdentity {
  component: unknown;
  priority?: number;
  themeSlug: string;
}

export interface ThemeLayoutDisableDefinition extends LayoutOwnerIdentity {
  priority?: number;
  themeSlug: string;
}

export interface ThemeLayoutOverrideRegistration {
  disables?: ThemeLayoutDisableDefinition[];
  replacements?: ThemeLayoutReplacementDefinition[];
  themeSlug: string;
}

export interface RegisteredThemeLayoutDisableDefinition extends LayoutOwnerIdentity {
  canonicalKey: string;
  priority: number;
  themeSlug: string;
}

export interface RegisteredThemeLayoutReplacementDefinition extends LayoutOwnerIdentity {
  canonicalKey: string;
  component: unknown;
  priority: number;
  themeSlug: string;
}

export interface LayoutDiagnosticEntry {
  code: LayoutDiagnosticCode;
  message: string;
  severity: LayoutDiagnosticSeverity;
  targetKey: string;
}

export interface ResolvedLayout {
  diagnostics: LayoutDiagnosticEntry[];
  source?: LayoutResolutionSource;
  status: LayoutResolutionStatus;
  targetKey: string;
  targetKind: LayoutTargetKind;
  winner?: unknown;
  winnerOwner?: string;
}
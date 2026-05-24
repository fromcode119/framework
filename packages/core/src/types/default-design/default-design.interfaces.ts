import type {
  DefaultDesignDiagnosticCode,
  DefaultDesignDiagnosticSeverity,
  DefaultDesignResolutionSource,
  DefaultDesignResolutionStatus,
  DefaultDesignTargetKind,
} from './default-design.types';

export interface DefaultDesignOwnerIdentity {
  namespace: string;
  pluginSlug: string;
  targetKey: string;
  targetKind: DefaultDesignTargetKind;
}

export interface PluginDefaultDesignDefinition extends DefaultDesignOwnerIdentity {
  component: unknown;
  priority?: number;
  required?: boolean;
}

export interface PluginDefaultDesignRegistration {
  namespace: string;
  pluginSlug: string;
  designs: PluginDefaultDesignDefinition[];
}

export interface RegisteredPluginDefaultDesignDefinition extends DefaultDesignOwnerIdentity {
  canonicalKey: string;
  component: unknown;
  priority: number;
  required: boolean;
}

export interface ThemeDesignReplacementDefinition extends DefaultDesignOwnerIdentity {
  component: unknown;
  priority?: number;
  themeSlug: string;
}

export interface ThemeDesignDisableDefinition extends DefaultDesignOwnerIdentity {
  priority?: number;
  themeSlug: string;
}

export interface ThemeDesignOverrideRegistration {
  disables?: ThemeDesignDisableDefinition[];
  replacements?: ThemeDesignReplacementDefinition[];
  themeSlug: string;
}

export interface RegisteredThemeDesignDisableDefinition extends DefaultDesignOwnerIdentity {
  canonicalKey: string;
  priority: number;
  themeSlug: string;
}

export interface RegisteredThemeDesignReplacementDefinition extends DefaultDesignOwnerIdentity {
  canonicalKey: string;
  component: unknown;
  priority: number;
  themeSlug: string;
}

export interface DefaultDesignDiagnosticEntry {
  code: DefaultDesignDiagnosticCode;
  message: string;
  severity: DefaultDesignDiagnosticSeverity;
  targetKey: string;
}

export interface ResolvedDefaultDesign {
  diagnostics: DefaultDesignDiagnosticEntry[];
  source?: DefaultDesignResolutionSource;
  status: DefaultDesignResolutionStatus;
  targetKey: string;
  targetKind: DefaultDesignTargetKind;
  winner?: unknown;
  winnerOwner?: string;
}
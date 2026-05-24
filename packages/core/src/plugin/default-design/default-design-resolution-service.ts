import type {
  DefaultDesignDiagnosticEntry,
  RegisteredPluginDefaultDesignDefinition,
  RegisteredThemeDesignDisableDefinition,
  RegisteredThemeDesignReplacementDefinition,
  ResolvedDefaultDesign,
} from '../../types';
import { ThemeDesignOverrideRegistryService } from '../../theme/theme-design-override-registry-service';
import { PluginDefaultDesignRegistryService } from './plugin-default-design-registry-service';

export class DefaultDesignResolutionService {
  constructor(
    private readonly pluginRegistry: PluginDefaultDesignRegistryService,
    private readonly themeRegistry: ThemeDesignOverrideRegistryService,
  ) {}

  get serviceName(): string {
    return 'DefaultDesignResolutionService';
  }

  resolvePageTarget(targetKey: string, activeThemeSlug?: string): ResolvedDefaultDesign {
    const normalizedTargetKey = this.normalizeRequiredString(targetKey, 'targetKey');
    const pluginEntry = this.getPluginPageEntry(normalizedTargetKey);
    const themeDisables = this.getThemeDisables(normalizedTargetKey, activeThemeSlug);
    const themeReplacements = this.getThemeReplacements(normalizedTargetKey, activeThemeSlug);
    const diagnostics = this.getConflictDiagnostics(normalizedTargetKey, themeReplacements);

    if (!pluginEntry) {
      return {
        targetKey: normalizedTargetKey,
        targetKind: 'page',
        status: 'missing',
        diagnostics,
      };
    }

    const disableWinner = this.pickDisableWinner(themeDisables);
    const replacementWinner = this.pickReplacementWinner(themeReplacements);

    if (disableWinner && pluginEntry.required && !replacementWinner) {
      diagnostics.push(this.createDiagnostic(
        'required-route-disabled',
        'error',
        normalizedTargetKey,
        `[DefaultDesignResolutionService] required page target cannot be disabled without a replacement: ${normalizedTargetKey}`,
      ));
    }

    if (replacementWinner) {
      return {
        targetKey: normalizedTargetKey,
        targetKind: 'page',
        status: 'resolved',
        source: 'theme-replacement',
        winner: replacementWinner.component,
        winnerOwner: replacementWinner.themeSlug,
        diagnostics,
      };
    }

    if (disableWinner && !pluginEntry.required) {
      return {
        targetKey: normalizedTargetKey,
        targetKind: 'page',
        status: 'disabled',
        diagnostics,
      };
    }

    return {
      targetKey: normalizedTargetKey,
      targetKind: 'page',
      status: 'resolved',
      source: 'plugin-default',
      winner: pluginEntry.component,
      winnerOwner: `${pluginEntry.namespace}:${pluginEntry.pluginSlug}`,
      diagnostics,
    };
  }

  private getPluginPageEntry(targetKey: string): RegisteredPluginDefaultDesignDefinition | undefined {
    return this.pluginRegistry
      .listPages()
      .filter((entry) => entry.targetKey === targetKey)
      .sort((left, right) => right.priority - left.priority || left.canonicalKey.localeCompare(right.canonicalKey))[0];
  }

  private getThemeDisables(targetKey: string, activeThemeSlug?: string): RegisteredThemeDesignDisableDefinition[] {
    return this.themeRegistry
      .listDisables()
      .filter((entry) => entry.targetKind === 'page' && entry.targetKey === targetKey)
      .filter((entry) => !activeThemeSlug || entry.themeSlug === activeThemeSlug);
  }

  private getThemeReplacements(targetKey: string, activeThemeSlug?: string): RegisteredThemeDesignReplacementDefinition[] {
    return this.themeRegistry
      .listReplacements()
      .filter((entry) => entry.targetKind === 'page' && entry.targetKey === targetKey)
      .filter((entry) => !activeThemeSlug || entry.themeSlug === activeThemeSlug);
  }

  private getConflictDiagnostics(
    targetKey: string,
    entries: RegisteredThemeDesignReplacementDefinition[],
  ): DefaultDesignDiagnosticEntry[] {
    if (entries.length < 2) {
      return [];
    }

    const ordered = entries
      .slice()
      .sort((left, right) => right.priority - left.priority || left.canonicalKey.localeCompare(right.canonicalKey));
    const [winner, next] = ordered;

    if (winner.priority === next.priority) {
      return [
        this.createDiagnostic(
          'theme-replacement-conflict',
          'error',
          targetKey,
          `[DefaultDesignResolutionService] equal-priority theme replacements conflict for ${targetKey}`,
        ),
      ];
    }

    return [];
  }

  private pickDisableWinner(
    entries: RegisteredThemeDesignDisableDefinition[],
  ): RegisteredThemeDesignDisableDefinition | undefined {
    return entries
      .slice()
      .sort((left, right) => right.priority - left.priority || left.canonicalKey.localeCompare(right.canonicalKey))[0];
  }

  private pickReplacementWinner(
    entries: RegisteredThemeDesignReplacementDefinition[],
  ): RegisteredThemeDesignReplacementDefinition | undefined {
    return entries
      .slice()
      .sort((left, right) => right.priority - left.priority || left.canonicalKey.localeCompare(right.canonicalKey))[0];
  }

  private createDiagnostic(
    code: DefaultDesignDiagnosticEntry['code'],
    severity: DefaultDesignDiagnosticEntry['severity'],
    targetKey: string,
    message: string,
  ): DefaultDesignDiagnosticEntry {
    return { code, severity, targetKey, message };
  }

  private normalizeRequiredString(value: string, label: string): string {
    const normalized = String(value || '').trim();
    if (!normalized) {
      throw new Error(`[DefaultDesignResolutionService] ${label} must be a non-empty string`);
    }
    return normalized;
  }
}
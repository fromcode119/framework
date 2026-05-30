import type {
  LayoutDiagnosticEntry,
  RegisteredPluginLayoutDefinition,
  RegisteredThemeLayoutDisableDefinition,
  RegisteredThemeLayoutReplacementDefinition,
  ResolvedLayout,
} from '../../types';
import { ThemeLayoutOverrideRegistryService } from '../../theme/theme-layout-override-registry-service';
import { PluginLayoutRegistryService } from './plugin-layout-registry-service';

export class LayoutResolutionService {
  constructor(
    private readonly pluginRegistry: PluginLayoutRegistryService,
    private readonly themeRegistry: ThemeLayoutOverrideRegistryService,
  ) {}

  get serviceName(): string {
    return 'LayoutResolutionService';
  }

  resolveTarget(
    targetKind: RegisteredPluginLayoutDefinition['targetKind'],
    targetKey: string,
    activeThemeSlug?: string,
  ): ResolvedLayout {
    const normalizedTargetKind = this.normalizeTargetKind(targetKind);
    const normalizedTargetKey = this.normalizeRequiredString(targetKey, 'targetKey');
    const pluginEntry = this.getPluginEntry(normalizedTargetKind, normalizedTargetKey);
    const themeDisables = this.getThemeDisables(normalizedTargetKind, normalizedTargetKey, activeThemeSlug);
    const themeReplacements = this.getThemeReplacements(normalizedTargetKind, normalizedTargetKey, activeThemeSlug);
    const diagnostics = this.getConflictDiagnostics(normalizedTargetKey, themeReplacements);

    if (!pluginEntry) {
      return {
        targetKey: normalizedTargetKey,
        targetKind: normalizedTargetKind,
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
        `[LayoutResolutionService] required ${normalizedTargetKind} target cannot be disabled without a replacement: ${normalizedTargetKey}`,
      ));
    }

    if (replacementWinner) {
      return {
        targetKey: normalizedTargetKey,
        targetKind: normalizedTargetKind,
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
        targetKind: normalizedTargetKind,
        status: 'disabled',
        diagnostics,
      };
    }

    return {
      targetKey: normalizedTargetKey,
      targetKind: normalizedTargetKind,
      status: 'resolved',
      source: 'plugin',
      winner: pluginEntry.component,
      winnerOwner: `${pluginEntry.namespace}:${pluginEntry.pluginSlug}`,
      diagnostics,
    };
  }

  resolvePageTarget(targetKey: string, activeThemeSlug?: string): ResolvedLayout {
    return this.resolveTarget('page', targetKey, activeThemeSlug);
  }

  private getPluginEntry(
    targetKind: RegisteredPluginLayoutDefinition['targetKind'],
    targetKey: string,
  ): RegisteredPluginLayoutDefinition | undefined {
    return this.pluginRegistry
      .listByTargetKind(targetKind)
      .filter((entry) => entry.targetKind === targetKind && entry.targetKey === targetKey)
      .sort((left, right) => right.priority - left.priority || left.canonicalKey.localeCompare(right.canonicalKey))[0];
  }

  private getThemeDisables(
    targetKind: RegisteredThemeLayoutDisableDefinition['targetKind'],
    targetKey: string,
    activeThemeSlug?: string,
  ): RegisteredThemeLayoutDisableDefinition[] {
    return this.themeRegistry
      .listDisables()
      .filter((entry) => entry.targetKind === targetKind && entry.targetKey === targetKey)
      .filter((entry) => !activeThemeSlug || entry.themeSlug === activeThemeSlug);
  }

  private getThemeReplacements(
    targetKind: RegisteredThemeLayoutReplacementDefinition['targetKind'],
    targetKey: string,
    activeThemeSlug?: string,
  ): RegisteredThemeLayoutReplacementDefinition[] {
    return this.themeRegistry
      .listReplacements()
      .filter((entry) => entry.targetKind === targetKind && entry.targetKey === targetKey)
      .filter((entry) => !activeThemeSlug || entry.themeSlug === activeThemeSlug);
  }

  private getConflictDiagnostics(
    targetKey: string,
    entries: RegisteredThemeLayoutReplacementDefinition[],
  ): LayoutDiagnosticEntry[] {
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
          `[LayoutResolutionService] equal-priority theme replacements conflict for ${targetKey}`,
        ),
      ];
    }

    return [];
  }

  private pickDisableWinner(
    entries: RegisteredThemeLayoutDisableDefinition[],
  ): RegisteredThemeLayoutDisableDefinition | undefined {
    return entries
      .slice()
      .sort((left, right) => right.priority - left.priority || left.canonicalKey.localeCompare(right.canonicalKey))[0];
  }

  private pickReplacementWinner(
    entries: RegisteredThemeLayoutReplacementDefinition[],
  ): RegisteredThemeLayoutReplacementDefinition | undefined {
    return entries
      .slice()
      .sort((left, right) => right.priority - left.priority || left.canonicalKey.localeCompare(right.canonicalKey))[0];
  }

  private createDiagnostic(
    code: LayoutDiagnosticEntry['code'],
    severity: LayoutDiagnosticEntry['severity'],
    targetKey: string,
    message: string,
  ): LayoutDiagnosticEntry {
    return { code, severity, targetKey, message };
  }

  private normalizeRequiredString(value: string, label: string): string {
    const normalized = String(value || '').trim();
    if (!normalized) {
      throw new Error(`[LayoutResolutionService] ${label} must be a non-empty string`);
    }
    return normalized;
  }

  private normalizeTargetKind(
    value: RegisteredPluginLayoutDefinition['targetKind'],
  ): RegisteredPluginLayoutDefinition['targetKind'] {
    if (value === 'page' || value === 'block' || value === 'slot') {
      return value;
    }
    throw new Error(`[LayoutResolutionService] unsupported targetKind: ${String(value)}`);
  }
}

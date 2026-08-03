import { LayoutDiagnosticSeverity } from '@core/layout/enums/layout-diagnostic-severity.enum';
import { LayoutDiagnosticCode } from '@core/layout/enums/layout-diagnostic-code.enum';
import { LayoutTargetKind } from '@core/layout/enums/layout-target-kind.enum';
import { LayoutResolutionSource } from '@core/layout/enums/layout-resolution-source.enum';
import { LayoutResolutionStatus } from '@core/layout/enums/layout-resolution-status.enum';
import type { ILayoutDiagnosticEntry } from '@core/layout/interfaces/layout-diagnostic-entry.interface';
import type { IRegisteredPluginLayoutDefinition } from '@core/layout/interfaces/registered-plugin-layout-definition.interface';
import type { IRegisteredThemeLayoutDisableDefinition } from '@core/layout/interfaces/registered-theme-layout-disable-definition.interface';
import type { IRegisteredThemeLayoutReplacementDefinition } from '@core/layout/interfaces/registered-theme-layout-replacement-definition.interface';
import type { IResolvedLayout } from '@core/layout/interfaces/resolved-layout.interface';
import { ThemeLayoutOverrideRegistryService } from '@core/theme/theme-layout-override-registry-service';
import { PluginLayoutRegistryService } from '@core/plugin/layout/plugin-layout-registry-service';

export class LayoutResolutionService {
  constructor(
    private readonly pluginRegistry: PluginLayoutRegistryService,
    private readonly themeRegistry: ThemeLayoutOverrideRegistryService,
  ) {}

  get serviceName(): string {
    return 'LayoutResolutionService';
  }

  resolveTarget(
    targetKind: IRegisteredPluginLayoutDefinition['targetKind'],
    targetKey: string,
    activeThemeSlug?: string,
  ): IResolvedLayout {
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
        status: LayoutResolutionStatus.MISSING,
        diagnostics,
      };
    }

    const disableWinner = this.pickDisableWinner(themeDisables);
    const replacementWinner = this.pickReplacementWinner(themeReplacements);

    if (disableWinner && pluginEntry.required && !replacementWinner) {
      diagnostics.push(this.createDiagnostic(
        LayoutDiagnosticCode.REQUIRED_ROUTE_DISABLED,
        LayoutDiagnosticSeverity.ERROR,
        normalizedTargetKey,
        `[LayoutResolutionService] required ${normalizedTargetKind} target cannot be disabled without a replacement: ${normalizedTargetKey}`,
      ));
    }

    if (replacementWinner) {
      return {
        targetKey: normalizedTargetKey,
        targetKind: normalizedTargetKind,
        status: LayoutResolutionStatus.RESOLVED,
        source: LayoutResolutionSource.THEME_REPLACEMENT,
        winner: replacementWinner.component,
        winnerOwner: replacementWinner.themeSlug,
        diagnostics,
      };
    }

    if (disableWinner && !pluginEntry.required) {
      return {
        targetKey: normalizedTargetKey,
        targetKind: normalizedTargetKind,
        status: LayoutResolutionStatus.DISABLED,
        diagnostics,
      };
    }

    return {
      targetKey: normalizedTargetKey,
      targetKind: normalizedTargetKind,
      status: LayoutResolutionStatus.RESOLVED,
      source: LayoutResolutionSource.PLUGIN,
      winner: pluginEntry.component,
      winnerOwner: `${pluginEntry.namespace}:${pluginEntry.pluginSlug}`,
      diagnostics,
    };
  }

  resolvePageTarget(targetKey: string, activeThemeSlug?: string): IResolvedLayout {
    return this.resolveTarget(LayoutTargetKind.PAGE, targetKey, activeThemeSlug);
  }

  private getPluginEntry(
    targetKind: IRegisteredPluginLayoutDefinition['targetKind'],
    targetKey: string,
  ): IRegisteredPluginLayoutDefinition | undefined {
    return this.pluginRegistry
      .listByTargetKind(targetKind)
      .filter((entry) => entry.targetKind === targetKind && entry.targetKey === targetKey)
      .sort((left, right) => right.priority - left.priority || left.canonicalKey.localeCompare(right.canonicalKey))[0];
  }

  private getThemeDisables(
    targetKind: IRegisteredThemeLayoutDisableDefinition['targetKind'],
    targetKey: string,
    activeThemeSlug?: string,
  ): IRegisteredThemeLayoutDisableDefinition[] {
    return this.themeRegistry
      .listDisables()
      .filter((entry) => entry.targetKind === targetKind && entry.targetKey === targetKey)
      .filter((entry) => !activeThemeSlug || entry.themeSlug === activeThemeSlug);
  }

  private getThemeReplacements(
    targetKind: IRegisteredThemeLayoutReplacementDefinition['targetKind'],
    targetKey: string,
    activeThemeSlug?: string,
  ): IRegisteredThemeLayoutReplacementDefinition[] {
    return this.themeRegistry
      .listReplacements()
      .filter((entry) => entry.targetKind === targetKind && entry.targetKey === targetKey)
      .filter((entry) => !activeThemeSlug || entry.themeSlug === activeThemeSlug);
  }

  private getConflictDiagnostics(
    targetKey: string,
    entries: IRegisteredThemeLayoutReplacementDefinition[],
  ): ILayoutDiagnosticEntry[] {
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
          LayoutDiagnosticCode.THEME_REPLACEMENT_CONFLICT,
          LayoutDiagnosticSeverity.ERROR,
          targetKey,
          `[LayoutResolutionService] equal-priority theme replacements conflict for ${targetKey}`,
        ),
      ];
    }

    return [];
  }

  private pickDisableWinner(
    entries: IRegisteredThemeLayoutDisableDefinition[],
  ): IRegisteredThemeLayoutDisableDefinition | undefined {
    return entries
      .slice()
      .sort((left, right) => right.priority - left.priority || left.canonicalKey.localeCompare(right.canonicalKey))[0];
  }

  private pickReplacementWinner(
    entries: IRegisteredThemeLayoutReplacementDefinition[],
  ): IRegisteredThemeLayoutReplacementDefinition | undefined {
    return entries
      .slice()
      .sort((left, right) => right.priority - left.priority || left.canonicalKey.localeCompare(right.canonicalKey))[0];
  }

  private createDiagnostic(
    code: ILayoutDiagnosticEntry['code'],
    severity: ILayoutDiagnosticEntry['severity'],
    targetKey: string,
    message: string,
  ): ILayoutDiagnosticEntry {
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
    value: IRegisteredPluginLayoutDefinition['targetKind'],
  ): IRegisteredPluginLayoutDefinition['targetKind'] {
    if (value === LayoutTargetKind.PAGE || value === LayoutTargetKind.BLOCK || value === LayoutTargetKind.SLOT) {
      return value;
    }
    throw new Error(`[LayoutResolutionService] unsupported targetKind: ${String(value)}`);
  }
}

import { LayoutDiagnosticCode } from '@core/layout/enums/layout-diagnostic-code.enum';
import { LayoutDiagnosticSeverity } from '@core/layout/enums/layout-diagnostic-severity.enum';
import { LayoutResolutionSource } from '@core/layout/enums/layout-resolution-source.enum';
import { LayoutResolutionStatus } from '@core/layout/enums/layout-resolution-status.enum';
import type { ILayoutDiagnosticEntry } from '@core/layout/interfaces/layout-diagnostic-entry.interface';
import type { IRegisteredPluginDefaultPageContract } from '@core/default-page-contract/interfaces/registered-plugin-default-page-contract.interface';
import { PluginLayoutRegistryService } from '@core/plugin/layout/plugin-layout-registry-service';
import { LayoutResolutionService } from '@core/plugin/layout/layout-resolution-service';

export class LayoutDiagnosticService {
  constructor(
    private readonly pluginRegistry: PluginLayoutRegistryService,
    private readonly resolutionService: LayoutResolutionService,
  ) {}

  get serviceName(): string {
    return 'LayoutDiagnosticService';
  }

  crossCheckDefaultPageContracts(
    contracts: IRegisteredPluginDefaultPageContract[],
    activeThemeSlug?: string,
  ): ILayoutDiagnosticEntry[] {
    const diagnostics: ILayoutDiagnosticEntry[] = [];
    const registeredTargets = new Set(this.pluginRegistry.listPages().map((entry) => entry.targetKey));
    const contractTargets = new Set<string>();

    for (const contract of contracts) {
      const targetKey = String(contract.recipe || '').trim();
      if (!targetKey) {
        continue;
      }

      contractTargets.add(targetKey);
      const resolution = this.resolutionService.resolvePageTarget(targetKey, activeThemeSlug);
      diagnostics.push(...resolution.diagnostics);

      if (resolution.status === LayoutResolutionStatus.MISSING) {
        diagnostics.push({
          code: LayoutDiagnosticCode.BACKEND_CONTRACT_PRESENT_FRONTEND_LAYOUT_MISSING,
          severity: contract.required ? LayoutDiagnosticSeverity.ERROR : LayoutDiagnosticSeverity.WARNING,
          targetKey,
          message: `[LayoutDiagnosticService] default page contract has no frontend design registration: ${targetKey}`,
        });
      }

      if (resolution.source === LayoutResolutionSource.THEME_REPLACEMENT) {
        diagnostics.push({
          code: LayoutDiagnosticCode.THEME_OVERRIDE_SELECTED,
          severity: LayoutDiagnosticSeverity.INFO,
          targetKey,
          message: `[LayoutDiagnosticService] theme replacement selected for page target: ${targetKey}`,
        });
      }
    }

    for (const targetKey of registeredTargets) {
      if (!contractTargets.has(targetKey)) {
        diagnostics.push({
          code: LayoutDiagnosticCode.FRONTEND_LAYOUT_PRESENT_BACKEND_CONTRACT_MISSING,
          severity: LayoutDiagnosticSeverity.WARNING,
          targetKey,
          message: `[LayoutDiagnosticService] frontend default page design has no backend contract: ${targetKey}`,
        });
      }
    }

    return diagnostics;
  }
}
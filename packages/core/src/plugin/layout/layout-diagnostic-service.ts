import type { LayoutDiagnosticEntry, RegisteredPluginDefaultPageContract } from '../../types';
import { PluginLayoutRegistryService } from './plugin-layout-registry-service';
import { LayoutResolutionService } from './layout-resolution-service';

export class LayoutDiagnosticService {
  constructor(
    private readonly pluginRegistry: PluginLayoutRegistryService,
    private readonly resolutionService: LayoutResolutionService,
  ) {}

  get serviceName(): string {
    return 'LayoutDiagnosticService';
  }

  crossCheckDefaultPageContracts(
    contracts: RegisteredPluginDefaultPageContract[],
    activeThemeSlug?: string,
  ): LayoutDiagnosticEntry[] {
    const diagnostics: LayoutDiagnosticEntry[] = [];
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

      if (resolution.status === 'missing') {
        diagnostics.push({
          code: 'backend-contract-present/frontend-layout-missing',
          severity: contract.required ? 'error' : 'warning',
          targetKey,
          message: `[LayoutDiagnosticService] default page contract has no frontend design registration: ${targetKey}`,
        });
      }

      if (resolution.source === 'theme-replacement') {
        diagnostics.push({
          code: 'theme-override-selected',
          severity: 'info',
          targetKey,
          message: `[LayoutDiagnosticService] theme replacement selected for page target: ${targetKey}`,
        });
      }
    }

    for (const targetKey of registeredTargets) {
      if (!contractTargets.has(targetKey)) {
        diagnostics.push({
          code: 'frontend-layout-present/backend-contract-missing',
          severity: 'warning',
          targetKey,
          message: `[LayoutDiagnosticService] frontend default page design has no backend contract: ${targetKey}`,
        });
      }
    }

    return diagnostics;
  }
}
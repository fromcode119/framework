import type { DefaultDesignDiagnosticEntry, RegisteredPluginDefaultPageContract } from '../../types';
import { PluginDefaultDesignRegistryService } from './plugin-default-design-registry-service';
import { DefaultDesignResolutionService } from './default-design-resolution-service';

export class DefaultDesignDiagnosticService {
  constructor(
    private readonly pluginRegistry: PluginDefaultDesignRegistryService,
    private readonly resolutionService: DefaultDesignResolutionService,
  ) {}

  get serviceName(): string {
    return 'DefaultDesignDiagnosticService';
  }

  crossCheckDefaultPageContracts(
    contracts: RegisteredPluginDefaultPageContract[],
    activeThemeSlug?: string,
  ): DefaultDesignDiagnosticEntry[] {
    const diagnostics: DefaultDesignDiagnosticEntry[] = [];
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
          code: 'backend-contract-present/frontend-default-missing',
          severity: contract.required ? 'error' : 'warning',
          targetKey,
          message: `[DefaultDesignDiagnosticService] default page contract has no frontend design registration: ${targetKey}`,
        });
      }

      if (resolution.source === 'theme-replacement') {
        diagnostics.push({
          code: 'theme-override-selected',
          severity: 'info',
          targetKey,
          message: `[DefaultDesignDiagnosticService] theme replacement selected for page target: ${targetKey}`,
        });
      }
    }

    for (const targetKey of registeredTargets) {
      if (!contractTargets.has(targetKey)) {
        diagnostics.push({
          code: 'frontend-default-present/backend-contract-missing',
          severity: 'warning',
          targetKey,
          message: `[DefaultDesignDiagnosticService] frontend default page design has no backend contract: ${targetKey}`,
        });
      }
    }

    return diagnostics;
  }
}
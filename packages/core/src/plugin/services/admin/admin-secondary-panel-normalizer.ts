import type { IAdminSecondaryPanelInputItem } from '@core/plugin/services/interfaces/admin-secondary-panel-input-item.interface';
import type { IAdminSecondaryPanelNormalizedItem } from '@core/plugin/services/interfaces/admin-secondary-panel-normalized-item.interface';

export class AdminSecondaryPanelNormalizer {
  normalize(input: IAdminSecondaryPanelInputItem): IAdminSecondaryPanelNormalizedItem {
    const scope = this.normalizeScope(input.item.scope?.value);
    const targetNamespace = this.normalizeTargetNamespace(scope, input);
    const targetPlugin = this.normalizeTargetPlugin(scope, input);
    const targetCanonicalKey = `${targetNamespace}:${targetPlugin}`;
    const id = String(input.item.id || '').trim();

    return {
      canonicalId: `${input.sourceCanonicalKey}:${scope}:${targetNamespace}:${targetPlugin}:${id}`,
      id,
      label: String(input.item.label || '').trim(),
      path: this.normalizePath(input.item.path),
      sourcePaths: this.normalizePathArray(input.item.sourcePaths),
      icon: String(input.item.icon || '').trim() || undefined,
      scope,
      sourceNamespace: input.sourceNamespace,
      sourcePlugin: input.sourcePlugin,
      sourceCanonicalKey: input.sourceCanonicalKey,
      targetNamespace,
      targetPlugin,
      targetCanonicalKey,
      priority: Number.isFinite(input.item.priority as number) ? Number(input.item.priority) : 100,
      group: String(input.item.group || '').trim() || undefined,
      description: String(input.item.description || '').trim() || undefined,
      requiredRoles: this.normalizeStringArray(input.item.requiredRoles),
      requiredCapabilities: this.normalizeStringArray(input.item.requiredCapabilities),
      advisorySourceNamespace: String(input.item.sourceNamespace || '').trim() || undefined,
      advisorySourcePlugin: String(input.item.sourcePlugin || '').trim() || undefined,
      allowGlobal: input.item.allowGlobal === true,
      governanceKey: String(input.item.governanceKey || '').trim() || undefined,
      // The two SCOPE flags. Normalising dropped them, so every panel entry reached the request
      // filter already stripped of the only fields that filter reads — which made both flags dead on
      // the secondary panel, however carefully an entry declared them: Localization and Appearance
      // were offered in the platform scope where they have no row to write, and Infrastructure,
      // Backups and Updates inside a site, where they change the box every other site runs on.
      // Carried as declared (undefined when absent), because the filter tests for `=== true`.
      siteOnly: input.item.siteOnly === true ? true : undefined,
      platformScopeOnly: input.item.platformScopeOnly === true ? true : undefined,
    };
  }

  private normalizeScope(scope?: string): string {
    const normalized = String(scope || 'self').trim().toLowerCase();
    if (normalized === 'plugin-target' || normalized === 'global') {
      return normalized;
    }
    return 'self';
  }

  private normalizeTargetNamespace(scope: string, input: IAdminSecondaryPanelInputItem): string {
    if (scope === 'plugin-target') {
      return String(input.item.targetNamespace || '').trim().toLowerCase();
    }
    if (scope === 'global') {
      return 'none';
    }
    return input.sourceNamespace;
  }

  private normalizeTargetPlugin(scope: string, input: IAdminSecondaryPanelInputItem): string {
    if (scope === 'plugin-target') {
      return String(input.item.targetPlugin || '').trim().toLowerCase();
    }
    if (scope === 'global') {
      return 'none';
    }
    return input.sourcePlugin;
  }

  private normalizePath(path: string): string {
    const trimmed = String(path || '').trim();
    if (!trimmed) {
      return '/';
    }
    return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  }

  private normalizeStringArray(values?: string[]): string[] {
    if (!Array.isArray(values)) {
      return [];
    }
    return values
      .map((entry) => String(entry || '').trim())
      .filter(Boolean);
  }

  private normalizePathArray(values?: string[]): string[] {
    if (!Array.isArray(values)) {
      return [];
    }

    return values
      .map((entry) => this.normalizePath(String(entry || '').trim()))
      .filter(Boolean);
  }
}

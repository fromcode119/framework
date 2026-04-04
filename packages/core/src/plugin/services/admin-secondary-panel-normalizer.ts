import { AdminSecondaryPanelInputItem, AdminSecondaryPanelNormalizedItem } from './admin-secondary-panel.interfaces';

export class AdminSecondaryPanelNormalizer {
  normalize(input: AdminSecondaryPanelInputItem): AdminSecondaryPanelNormalizedItem {
    const scope = this.normalizeScope(input.item.scope);
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
    };
  }

  private normalizeScope(scope?: string): string {
    const normalized = String(scope || 'self').trim().toLowerCase();
    if (normalized === 'plugin-target' || normalized === 'global') {
      return normalized;
    }
    return 'self';
  }

  private normalizeTargetNamespace(scope: string, input: AdminSecondaryPanelInputItem): string {
    if (scope === 'plugin-target') {
      return String(input.item.targetNamespace || '').trim().toLowerCase();
    }
    if (scope === 'global') {
      return 'none';
    }
    return input.sourceNamespace;
  }

  private normalizeTargetPlugin(scope: string, input: AdminSecondaryPanelInputItem): string {
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

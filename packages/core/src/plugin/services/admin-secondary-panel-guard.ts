import { AdminSecondaryPanelNormalizedItem, AdminSecondaryPanelRejection } from './admin-secondary-panel.interfaces';

export class AdminSecondaryPanelGuard {
  validate(item: AdminSecondaryPanelNormalizedItem): AdminSecondaryPanelRejection | null {
    if (!item.sourceNamespace || !item.sourcePlugin) {
      return this.rejection('INVALID_SOURCE_IDENTITY', item, 'Registration-derived source identity is missing');
    }

    const expectedCanonicalKey = `${item.sourceNamespace}:${item.sourcePlugin}`;
    if (item.sourceCanonicalKey !== expectedCanonicalKey) {
      return this.rejection('INVALID_SOURCE_CANONICAL_KEY', item, 'Canonical source key does not match source namespace/plugin');
    }

    if (item.advisorySourceNamespace && item.advisorySourceNamespace.toLowerCase() !== item.sourceNamespace) {
      return this.rejection('SOURCE_IDENTITY_MISMATCH', item, 'Manifest advisory sourceNamespace differs from registration identity');
    }

    if (item.advisorySourcePlugin && item.advisorySourcePlugin.toLowerCase() !== item.sourcePlugin) {
      return this.rejection('SOURCE_IDENTITY_MISMATCH', item, 'Manifest advisory sourcePlugin differs from registration identity');
    }

    if (!item.path.startsWith('/')) {
      return this.rejection('INVALID_PATH', item, 'Secondary panel path must start with /');
    }

    if (item.scope !== 'self' && item.scope !== 'plugin-target' && item.scope !== 'global') {
      return this.rejection('INVALID_SCOPE', item, 'Scope must be one of self, plugin-target, or global');
    }

    if (item.scope === 'plugin-target' && (!item.targetNamespace || !item.targetPlugin)) {
      return this.rejection('INVALID_PLUGIN_TARGET', item, 'plugin-target scope requires targetNamespace and targetPlugin');
    }

    if (item.scope === 'global' && item.allowGlobal !== true) {
      return this.rejection('GLOBAL_NOT_ALLOWED', item, 'global scope requires allowGlobal=true');
    }

    if (item.scope === 'global' && !item.governanceKey) {
      return this.rejection('MISSING_GOVERNANCE_KEY', item, 'global scope requires governanceKey');
    }

    return null;
  }

  private rejection(reasonCode: string, item: AdminSecondaryPanelNormalizedItem, details: string): AdminSecondaryPanelRejection {
    return {
      reasonCode,
      sourceCanonicalKey: item.sourceCanonicalKey,
      itemId: item.id,
      scope: item.scope,
      targetCanonicalKey: item.targetCanonicalKey,
      details,
    };
  }
}

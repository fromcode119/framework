import {
  AdminSecondaryPanelAllowlistEntry,
  AdminSecondaryPanelNormalizedItem,
  AdminSecondaryPanelRejection,
} from './admin-secondary-panel.interfaces';

export class AdminSecondaryPanelGovernanceService {
  isAllowed(item: AdminSecondaryPanelNormalizedItem, allowlistEntries: AdminSecondaryPanelAllowlistEntry[]): AdminSecondaryPanelRejection | null {
    if (item.scope === 'self') {
      return null;
    }

    const matches = allowlistEntries.filter((entry) => {
      if (this.isExpired(entry.expiresAt)) {
        return false;
      }
      return (
        String(entry.sourceCanonicalKey || '').toLowerCase() === item.sourceCanonicalKey &&
        String(entry.scope || '').toLowerCase() === item.scope &&
        String(entry.targetCanonicalKey || '').toLowerCase() === item.targetCanonicalKey
      );
    });

    if (matches.length === 0) {
      return this.rejection('GOVERNANCE_NOT_ALLOWLISTED', item, 'No allowlist entry matched this contribution');
    }

    const sorted = matches.slice().sort((a, b) => {
      if (a.allowed !== b.allowed) {
        return a.allowed ? 1 : -1;
      }
      const aUpdated = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const bUpdated = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return bUpdated - aUpdated;
    });

    const winner = sorted[0];
    if (winner.allowed !== true) {
      return this.rejection('GOVERNANCE_DENIED', item, winner.reason || 'Allowlist entry denied this contribution');
    }

    return null;
  }

  private isExpired(value?: string): boolean {
    if (!value) {
      return false;
    }
    const expiresAt = new Date(value).getTime();
    if (!Number.isFinite(expiresAt)) {
      return false;
    }
    return expiresAt < Date.now();
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

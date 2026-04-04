import { SecondaryPanelItemManifest } from '../../types';

export interface AdminSecondaryPanelAllowlistEntry {
  entryId?: string;
  sourceCanonicalKey: string;
  scope: string;
  targetCanonicalKey: string;
  allowed: boolean;
  reason?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
  expiresAt?: string;
}

export interface AdminSecondaryPanelInputItem {
  sourceNamespace: string;
  sourcePlugin: string;
  sourceCanonicalKey: string;
  item: SecondaryPanelItemManifest;
}

export interface AdminSecondaryPanelNormalizedItem {
  canonicalId: string;
  id: string;
  label: string;
  path: string;
  sourcePaths: string[];
  icon?: string;
  scope: string;
  sourceNamespace: string;
  sourcePlugin: string;
  sourceCanonicalKey: string;
  targetNamespace: string;
  targetPlugin: string;
  targetCanonicalKey: string;
  priority: number;
  group?: string;
  description?: string;
  requiredRoles: string[];
  requiredCapabilities: string[];
  advisorySourceNamespace?: string;
  advisorySourcePlugin?: string;
  allowGlobal?: boolean;
  governanceKey?: string;
}

export interface AdminSecondaryPanelRejection {
  reasonCode: string;
  sourceCanonicalKey: string;
  itemId: string;
  scope: string;
  targetCanonicalKey: string;
  details?: string;
}

export interface AdminSecondaryPanelContext {
  id: string;
  label: string;
  targetNamespace: string;
  targetPlugin: string;
  targetCanonicalKey: string;
}

export interface AdminSecondaryPanelPayload {
  version: number;
  contexts: Record<string, AdminSecondaryPanelContext>;
  itemsByContext: Record<string, AdminSecondaryPanelNormalizedItem[]>;
  globalItems: AdminSecondaryPanelNormalizedItem[];
  policy: {
    allowlistKey: string;
    allowlistEntries: number;
    evaluatedAt: string;
  };
  precedence: {
    scopeOrder: string[];
    tieBreakOrder: string[];
  };
}

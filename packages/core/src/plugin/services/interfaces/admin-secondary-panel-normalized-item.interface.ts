export interface IAdminSecondaryPanelNormalizedItem {
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
  /** See `ISecondaryPanelItemManifest.siteOnly` — carried through so the request filter can read it. */
  siteOnly?: boolean;
  /** See `ISecondaryPanelItemManifest.platformScopeOnly` — same reason. */
  platformScopeOnly?: boolean;
}

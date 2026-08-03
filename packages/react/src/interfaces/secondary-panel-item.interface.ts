export interface ISecondaryPanelItem {
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
}

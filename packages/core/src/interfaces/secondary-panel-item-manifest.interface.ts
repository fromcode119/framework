import { CapabilityScope } from '@core/enums/capability-scope.enum';

export interface ISecondaryPanelItemManifest {
  id: string;
  label: string;
  path: string;
  sourcePaths?: string[];
  icon?: string;
  scope?: CapabilityScope;
  targetNamespace?: string;
  targetPlugin?: string;
  priority?: number;
  requiredRoles?: string[];
  requiredCapabilities?: string[];
  group?: string;
  description?: string;
  sourceNamespace?: string;
  sourcePlugin?: string;
  allowGlobal?: boolean;
  governanceKey?: string;
}

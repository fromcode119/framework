import { ILayoutOwnerIdentity } from '@core/layout/interfaces/layout-owner-identity.interface';

export interface IRegisteredPluginLayoutDefinition extends ILayoutOwnerIdentity {
  canonicalKey: string;
  component: unknown;
  priority: number;
  required: boolean;
}

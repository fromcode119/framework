import { ILayoutOwnerIdentity } from '@core/layout/interfaces/layout-owner-identity.interface';

export interface IPluginLayoutDefinition extends ILayoutOwnerIdentity {
  component: unknown;
  priority?: number;
  required?: boolean;
}

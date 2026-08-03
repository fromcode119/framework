import { ILayoutOwnerIdentity } from '@core/layout/interfaces/layout-owner-identity.interface';

export interface IRegisteredThemeLayoutDisableDefinition extends ILayoutOwnerIdentity {
  canonicalKey: string;
  priority: number;
  themeSlug: string;
}

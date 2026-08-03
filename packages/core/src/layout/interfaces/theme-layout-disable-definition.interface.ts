import { ILayoutOwnerIdentity } from '@core/layout/interfaces/layout-owner-identity.interface';

export interface IThemeLayoutDisableDefinition extends ILayoutOwnerIdentity {
  priority?: number;
  themeSlug: string;
}

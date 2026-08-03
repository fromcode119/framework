import { ILayoutOwnerIdentity } from '@core/layout/interfaces/layout-owner-identity.interface';

export interface IThemeLayoutReplacementDefinition extends ILayoutOwnerIdentity {
  component: unknown;
  priority?: number;
  themeSlug: string;
}

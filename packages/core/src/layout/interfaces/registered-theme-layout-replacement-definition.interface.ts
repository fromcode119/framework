import { ILayoutOwnerIdentity } from '@core/layout/interfaces/layout-owner-identity.interface';

export interface IRegisteredThemeLayoutReplacementDefinition extends ILayoutOwnerIdentity {
  canonicalKey: string;
  component: unknown;
  priority: number;
  themeSlug: string;
}

import type { IAppearanceWorkspaceDeclaration } from '@core/appearance/interfaces/appearance-workspace-declaration.interface';

/** Manifest for an installable admin appearance (appearance.json at the package root). */
export interface IAppearanceManifest {
  slug: string;
  /** The vendor (`org.fromcode`). An appearance with the same slug from another vendor is refused at install. */
  namespace?: string;
  name?: string;
  version?: string;
  description?: string;
  author?: string;
  /** Present when the appearance is a product console that provisions its own workspace kind. */
  workspace?: IAppearanceWorkspaceDeclaration;
}

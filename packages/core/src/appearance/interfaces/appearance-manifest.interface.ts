import type { IAppearanceWorkspaceDeclaration } from '@core/appearance/interfaces/appearance-workspace-declaration.interface';

/** Manifest for an installable admin appearance (appearance.json at the package root). */
export interface IAppearanceManifest {
  slug: string;
  /** The vendor (`org.fromcode`). An appearance with the same slug from another vendor is refused at install. */
  namespace?: string;
  /** What the console is called while this appearance draws it: the browser tab, the installed app. */
  name?: string;
  version?: string;
  description?: string;
  /**
   * The appearance's icon, a file in its `ui/` folder (`mark.png`). The console's tab icon and
   * home-screen icon on a site that wears it; absent, the platform's own icon stays.
   */
  icon?: string;
  author?: string;
  /** Present when the appearance is a product console that provisions its own workspace kind. */
  workspace?: IAppearanceWorkspaceDeclaration;
}

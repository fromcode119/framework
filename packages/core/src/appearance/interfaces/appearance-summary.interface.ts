import type { IAppearanceWorkspaceDeclaration } from '@core/appearance/interfaces/appearance-workspace-declaration.interface';

/** Lightweight summary of an available admin appearance (for the Settings → Appearance picker). */
export interface IAppearanceSummary {
  slug: string;
  name: string;
  version: string;
  builtIn: boolean;
  /** The package URL it was installed from, if any — lets the UI offer a one-click update (re-install). */
  sourceUrl?: string;
  /** The workspace this appearance declares, when it is a product console (see the manifest). */
  workspace?: IAppearanceWorkspaceDeclaration;
}

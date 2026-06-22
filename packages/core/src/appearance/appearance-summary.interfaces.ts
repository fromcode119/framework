/** Lightweight summary of an available admin appearance (for the Settings → Appearance picker). */
export interface AppearanceSummary {
  slug: string;
  name: string;
  version: string;
  builtIn: boolean;
  /** The package URL it was installed from, if any — lets the UI offer a one-click update (re-install). */
  sourceUrl?: string;
}

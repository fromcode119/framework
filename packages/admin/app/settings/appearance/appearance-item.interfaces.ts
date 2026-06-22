/** One row in the Settings → Appearance picker (mirrors the API's AppearanceSummary). */
export interface AppearanceItem {
  slug: string;
  name: string;
  version: string;
  builtIn: boolean;
  sourceUrl?: string;
}

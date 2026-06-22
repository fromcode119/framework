/** Manifest for an installable admin appearance (appearance.json at the package root). */
export interface AppearanceManifest {
  slug: string;
  name?: string;
  version?: string;
  description?: string;
  author?: string;
}

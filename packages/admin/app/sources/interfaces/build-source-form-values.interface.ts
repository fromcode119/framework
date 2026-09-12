export interface IBuildSourceFormValues {
  /** Which provider fetches this source. Stored on the row; see SourceProviders. */
  provider: string;
  autoBuild: boolean;
  autoUpdate: boolean;
  installAfterBuild: boolean;
  branch: string;
  gitSecret: string;
  gitUrl: string;
  slug: string;
  /** Detected from the repository's own manifest, never chosen — see ExtensionManifestReader. */
  type: 'plugin' | 'theme' | 'appearance' | 'core';
}

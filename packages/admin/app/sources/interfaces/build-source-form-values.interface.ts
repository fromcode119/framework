export interface IBuildSourceFormValues {
  /** Which provider fetches this source. Stored on the row; see SourceProviders. */
  provider: string;
  autoBuild: boolean;
  autoUpdate: boolean;
  branch: string;
  gitSecret: string;
  gitUrl: string;
  slug: string;
  type: 'plugin' | 'theme' | 'core';
}

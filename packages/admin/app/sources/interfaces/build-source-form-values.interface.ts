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
  /**
   * Detected from the repository's own manifest, never chosen — see ExtensionManifestReader.
   *
   * An `ExtensionScope` VALUE, carried as the string the API stores. It was spelled out here as
   * `'plugin' | 'theme' | 'appearance' | 'core'`, a fourth copy of a list `ExtensionScope` already
   * owns — and every place that produced one resolved through the enum and then cast BACK to this
   * union, so the union existed only to give those casts somewhere to land. The server may also know
   * a kind this admin build does not; a closed union here cannot hold one.
   */
  type: string;
}

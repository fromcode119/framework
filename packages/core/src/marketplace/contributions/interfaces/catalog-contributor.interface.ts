/**
 * Something that can offer installable versions to the catalogue.
 *
 * `list` is called whenever the catalogue is read, so it must be cheap — a query over what this
 * contributor has already produced, never a network call to a git host.
 */
export interface ICatalogContributor {
  namespace: string;
  pluginSlug: string;
  list(): Promise<Array<Record<string, unknown>>> | Array<Record<string, unknown>>;

  /**
   * Where one of this contributor's offers actually IS on disk, for an installer about to use it.
   *
   * A contributed offer is a FILE this installation already produced, not a URL — but the catalogue
   * shape it borrows only has `downloadUrl`, so an installer resolved that bare filename against the
   * remote marketplace and fetched a package that was never there. Asking here keeps the real path
   * server-side: it never reaches the browser, and nothing the caller sent decides which file opens.
   *
   * Optional, because a contributor may offer versions it does not host — it returns null and the
   * installer says the package is not available here rather than inventing a location for it.
   */
  resolveArtifact?(slug: string, kind: string): Promise<string | null> | string | null;
}

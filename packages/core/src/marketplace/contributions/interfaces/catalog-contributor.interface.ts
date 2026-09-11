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
}

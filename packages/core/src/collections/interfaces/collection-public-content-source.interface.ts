/**
 * One collection that declares {@link ICollectionPublicContent}, as `context.collections.publicContent()`
 * answers it — plain data, so it crosses into an isolated plugin's process unchanged.
 *
 * Call `list` / `at` as `context.plugins.namespace(namespace)[plugin][method](…)`.
 */
export interface ICollectionPublicContentSource {
  /** The owning plugin's slug. */
  plugin: string;
  /** The owning plugin's manifest namespace. */
  namespace: string;
  /** The slug the owner DECLARED — the identity its collection hook events carry. */
  slug: string;
  /** The collection's own name (`ICollection.displayName`, or its capitalized slug) — the owner names its content. */
  label: string;
  /** The entity the collection provides (`'product'`), when it declares one. */
  entity: string;
  list: string;
  at: string;
}

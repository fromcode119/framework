/**
 * The slug-bearing shape of a plugin collection, as much of it as admin-route building needs.
 *
 * Structural on purpose: callers pass their own collection objects (which carry far more) and this names
 * only the three fields the route builder reads — so it is a contract, not a data record.
 */
export interface IPluginCollectionLike {
  slug?: string;
  shortSlug?: string;
  unprefixedSlug?: string;
}

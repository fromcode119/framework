/**
 * A collection whose records carry a Visibility field (`PublicListing.field()`). The framework then
 * keeps a visitor's generic reads to what Visibility lists in the catalogue, and a read of ONE record
 * by one of `pinnedBy` (its address keys) finds it whatever its Visibility, so a record set to
 * "Nowhere" still opens at its link. Declared as data, so the rule needs no call into the plugin.
 */
export interface ICollectionPublicListing {
  readonly pinnedBy: readonly string[];
}

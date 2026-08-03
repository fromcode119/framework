export class ThemePrefetchFromPageConfig {
  /** Query param the derived values are joined into (comma-separated), e.g. "slugs". */
  declare queryParam: string;
  /**
   * Where the values come from on the RESOLVED page document (framework stays
   * domain-agnostic — these are generic document/block shapes, not plugin keys):
   *  - 'pageSlug': the document's own slug.
   *  - 'blockSlugs': slug references found in the document's content blocks
   *    (generic `slugs`/`productSlugs`/`productSlug`/`slug` keys under block `data`).
   * Defaults to ['pageSlug'].
   */
  declare sources?: ('pageSlug' | 'blockSlugs')[];
  /** Cap on derived values (default 3) so the injected payload stays small. */
  declare maxValues?: number;
}

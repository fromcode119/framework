/** One pass over the extension dependency graph: what was found, and what is still needed. */
export class StackExtensionWalk {
  constructor(
    /** Slug to the directory it will be mounted from. */
    readonly found: ReadonlyMap<string, string>,
    /** Slugs that nothing could supply, by the extension that declared them. */
    readonly missing: ReadonlyMap<string, string[]>,
  ) {}
}

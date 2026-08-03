/**
 * One public route a plugin publishes through the frontend proxy: which plugin owns it, the path the
 * visitor requests, the plugin path it forwards to, and the content type to send back.
 *
 * A data record, so a CLASS rather than a `type` alias. No `from()` hydrator here on purpose — the
 * paths are normalised by `PublicRouteProxy.normalizePath`, so the proxy constructs it directly rather
 * than this class re-implementing that normalisation.
 */
export class PublicRouteDefinition {
  constructor(
    readonly pluginSlug: string,
    readonly path: string,
    readonly targetPath: string,
    readonly contentType: string,
  ) {}
}

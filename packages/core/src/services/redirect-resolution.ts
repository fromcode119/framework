/**
 * Where a request path that resolved to NO content should be sent instead.
 *
 * A "redirect resolver" (see `IRedirectResolver`) is a plugin-supplied function that may produce one
 * of these. The framework holds NO knowledge of where the rules live (an SEO plugin, a CMS table, …)
 * — it only runs the registered resolvers in order and returns the first match. That keeps
 * URL-redirect handling framework-owned at the routing layer while leaving rule storage/UI to
 * whichever plugin owns it.
 *
 * "No redirect" is `RedirectResolution | null` at the call site rather than a `null` folded into the
 * shape itself.
 */
export class RedirectResolution {
  /** The path or absolute URL to redirect to. */
  declare target: string;

  /** `true` → 308/301 (permanent), `false` → 307/302. */
  declare permanent: boolean;
}

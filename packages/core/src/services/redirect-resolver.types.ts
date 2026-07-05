/**
 * Types for the redirect-resolver registry.
 *
 * A "redirect resolver" is a plugin-supplied function that, given a request path that resolved to NO
 * content, may return a redirect target. The framework holds NO knowledge of where the rules live
 * (an SEO plugin, a CMS table, …) — it only runs the registered resolvers in order and returns the
 * first match. This keeps URL-redirect handling framework-owned at the routing layer while leaving the
 * rule storage/UI to whichever plugin owns it.
 */

export type RedirectResolution = { target: string; permanent: boolean } | null;

export type RedirectResolver = (path: string) => Promise<RedirectResolution> | RedirectResolution;

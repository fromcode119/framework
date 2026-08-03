import type { RedirectResolution } from '@core/services/redirect-resolution';

/**
 * A plugin-supplied rule lookup: given a request path that resolved to no content, return where it
 * should go, or `null` to pass to the next resolver.
 *
 * A call-signature contract has no class form, so this stays an `interface`.
 */
export interface IRedirectResolver {
  (path: string): Promise<RedirectResolution | null> | RedirectResolution | null;
}

import { LocaleUrlStrategy } from '@fromcode119/core/client';
import { QueryParamUtils } from '@/lib/query-param-utils';

/**
 * Decides whether a request that RESOLVED to a document arrived on the wrong path.
 *
 * A plugin declares the one path its document is served at (see core's canonical-path registry); the API
 * hands that back on `/system/resolve` as `canonicalPath`. Anything that resolves the same document on a
 * different path is a duplicate of it, so the route answers with a redirect instead of rendering — the
 * page is never painted on the non-canonical path, and crawlers get one indexable URL per document
 * rather than one per route that happens to match.
 *
 * This is ROUTING, not SEO. It moves visitors, so it is driven only by a path the owning plugin declares
 * as the document's real home — never by an operator's `<link rel=canonical>` override, which is a hint
 * to search engines and must leave navigation alone.
 */
export class CanonicalPathRedirect {
  /**
   * The path to redirect to, or `''` to render normally.
   *
   * @param canonicalPath locale-free root-relative path from the resolver, `''` when none was declared
   * @param requestSlug   the request path with any locale prefix already stripped, no leading slash
   * @param pathLocale    the locale segment that was stripped, or `''`
   */
  static resolveTarget(input: {
    canonicalPath: string;
    requestSlug: string;
    pathLocale: string;
    strategy: LocaleUrlStrategy;
    searchParams: Record<string, string | string[] | undefined> | undefined;
  }): string {
    // Preview is the operator inspecting one specific draft at one specific path, with their admin
    // session forwarded on that exact request. Bouncing them mid-preview would look like the preview
    // link is broken, so leave every preview navigation where it is.
    if (QueryParamUtils.isPreviewMode(input.searchParams)) return '';

    const canonical = CanonicalPathRedirect.normalize(input.canonicalPath);
    if (!canonical) return '';

    const current = CanonicalPathRedirect.normalize(`/${String(input.requestSlug || '').replace(/^\/+/, '')}`);
    // Already home: the overwhelmingly common case, and the loop guard. Without this every canonical
    // path would redirect to itself forever.
    if (!current || current === canonical) return '';

    const localized = CanonicalPathRedirect.applyLocalePrefix(canonical, input.pathLocale, input.strategy);
    const query = CanonicalPathRedirect.buildQueryString(input.searchParams);
    return query ? `${localized}?${query}` : localized;
  }

  /**
   * Re-attaches the locale segment the catch-all stripped, so a visitor on `/bg/shop/x` lands on
   * `/bg/cosmic-box/x` and stays in their language instead of being dropped onto the default locale.
   * Resolver-declared paths are locale-free by contract, which is what makes this safe to prepend.
   */
  private static applyLocalePrefix(path: string, pathLocale: string, strategy: LocaleUrlStrategy): string {
    const locale = String(pathLocale || '').trim();
    if (!locale || strategy !== LocaleUrlStrategy.PATH) return path;
    return path === '/' ? `/${locale}` : `/${locale}${path}`;
  }

  /** Carries the query through, so `?variant=red` and campaign tags survive the hop. */
  private static buildQueryString(searchParams: Record<string, string | string[] | undefined> | undefined): string {
    if (!searchParams) return '';
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (value === undefined) continue;
      if (Array.isArray(value)) {
        value.forEach((entry) => query.append(key, String(entry)));
        continue;
      }
      query.append(key, String(value));
    }
    return query.toString();
  }

  /**
   * `/a/b` for a root-relative site path, `''` for anything else.
   *
   * The off-site rejection is repeated here on purpose. Core's registry already discards absolute and
   * protocol-relative values, but this function is what a `redirect()` call consumes: a value that
   * reached here from anywhere else must not be able to send a visitor to another origin.
   */
  private static normalize(value: unknown): string {
    const raw = String(value ?? '').trim();
    if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return '';
    const withoutHash = raw.split('#')[0];
    const withoutQuery = withoutHash.split('?')[0];
    const trimmed = withoutQuery.replace(/\/+$/, '');
    return trimmed || '/';
  }
}

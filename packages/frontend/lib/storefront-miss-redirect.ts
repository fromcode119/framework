import { MissedResolutionFetch } from '@/lib/missed-resolution-fetch';
import { ServerApiUnreachableError } from '@/lib/server-api-unreachable-error';
import type { IResolvedDocResult } from '@/lib/interfaces/resolved-doc-result.interface';
import type { IStorefrontRedirectRule } from '@/lib/interfaces/storefront-redirect-rule.interface';

/** The configured redirect rule, if any, for a storefront path that resolved to no content. */
export class StorefrontMissRedirect {
  /**
   * The redirect rule for a path that resolved to no content. A lookup that already reported the miss
   * carries the API's answer (the resolve endpoint consults the redirect registry itself), so asking
   * again would only repeat the whole resolution; any other lookup asks once, as the last word.
   *
   * `reportable: false` — the path is not a miss (the framework answers it itself, e.g. sign-in): the
   * lookup already made carries any rule the API matched, so no second, miss-reporting lookup is made.
   * That second lookup logged every visit to /login as a 404, moved the site's content revision and
   * kept the page out of the document cache.
   */
  static async afterMiss(slug: string, resolution: IResolvedDocResult | null, reportable = true): Promise<IStorefrontRedirectRule | null> {
    if (resolution?.missReported || !reportable) return resolution?.redirect ?? null;
    return StorefrontMissRedirect.lookup(slug);
  }

  static of(result: Record<string, any>): IStorefrontRedirectRule | null {
    if (result?.type !== 'redirect') return null;
    if (result.redirect?.gone === true) return { target: '', permanent: true, gone: true };
    if (result.redirect?.target) return { target: String(result.redirect.target), permanent: result.redirect.permanent !== false, gone: false };
    return null;
  }

  /**
   * Looks up a configured redirect rule for a would-be-404 path via the framework's OWN resolve endpoint.
   * The framework's route resolver consults a plugin-agnostic redirect registry (a redirect plugin, a content
   * table, … register into it) and returns a `redirect` resolution — so the frontend never names a plugin.
   * Returns the target + whether it's permanent (308) or temporary (307), or null when no rule matches.
   * A malformed payload resolves to null so a lookup quirk never breaks the page — but an
   * UNREACHABLE API is re-thrown, because "no redirect rule matched" and "we could not ask"
   * are different answers and only the first one justifies a 404.
   */
  static async lookup(slug: string): Promise<IStorefrontRedirectRule | null> {
    try {
      const query = new URLSearchParams();
      query.set('slug', String(slug || '').replace(/^\/+/, ''));
      // The final lookup before a 404: `missed=1` lets the API report the miss with the VISITOR's
      // referrer and browser (this fetch otherwise carries the storefront server's own).
      query.set('missed', '1');
      const result = await MissedResolutionFetch.fetch(query.toString());
      if (result) return StorefrontMissRedirect.of(result);
    } catch (error) {
      if (error instanceof ServerApiUnreachableError) throw error;
      /* malformed lookup payload — fall through to the normal 404 */
    }
    return null;
  }
}

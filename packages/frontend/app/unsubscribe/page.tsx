import { connection } from 'next/server';
import { TokenEmailPreferencesPanel } from '@fromcode119/react/account/token-email-preferences-panel.client';
import { DynamicContentClient } from '@/app/components/view/dynamic-content-client.client';
import { DynamicPageResolver } from '@/lib/dynamic-page-resolver';
import { QueryParamUtils } from '@/lib/query-param-utils';

/**
 * The global email preferences page — every stream this platform sends, on one screen, reachable from
 * a link in any message.
 *
 * A NATIVE route rather than a plugin page contract, and that is the point. A page materialized from a
 * contract renders through `DefaultPageDesignRenderer`, which resolves from a registry only the Next
 * bundle populates — so those pages paint an empty box on the server and fill in on hydration. This one
 * is a real route, so it renders server-side like `/verify-email` and `/forgot-password` beside it.
 *
 * It is also the only unsubscribe surface that can list streams from EVERY plugin. A plugin page
 * enumerating other plugins' categories would be the cross-plugin coupling the architecture forbids;
 * the suppression list and the category registry are framework-owned, so this page is too.
 *
 * ## Why it resolves a themed page first
 *
 * It used to return the bare panel, and "renders server-side like /forgot-password beside it" was only
 * half true: those routes ALSO resolve a themed CMS page and hand it to `DynamicContentClient`, which is
 * what wraps them in the theme's layout. This one skipped that step, so it shipped with no nav, no
 * footer and no container — the card sat flush against the top of the viewport on an otherwise fully
 * branded site. Resolving the themed page first makes the three native routes behave alike; the theme
 * renders this panel for the page's slug exactly as it renders `AccountShell` for `/account`.
 *
 * The bare panel remains the fallback for an install whose theme seeds no such page: an unsubscribe link
 * must work on every install, so a missing CMS page degrades the CHROME and never the function.
 *
 * No auth guard: most recipients have no account. The signed token in the query is the credential, and
 * the endpoint behind this panel derives the address from that token alone. The token is read from the
 * URL by the panel itself, so it survives the themed-page path untouched.
 */
export class UnsubscribePageRoute {
  /** The CMS slug a theme seeds to brand this route. Greppable, and named in one place only. */
  static readonly PAGE_SLUG = 'unsubscribe';

  static async render({
    searchParams,
  }: {
    searchParams?: (Record<string, string | string[] | undefined> | Promise<Record<string, string | string[] | undefined>>);
  }) {
    // Opt into dynamic rendering without a route-segment `export const`.
    await connection();

    try {
      const resolvedSearchParams = await QueryParamUtils.resolveSearchParams(searchParams);
      const routingConfig = await DynamicPageResolver.getLocaleRoutingConfig();
      const locale = await DynamicPageResolver.resolveLocale(resolvedSearchParams, '', routingConfig.strategy);
      const content = await DynamicPageResolver.resolveDocWithPermalinkFallback(
        UnsubscribePageRoute.PAGE_SLUG,
        resolvedSearchParams,
        locale,
        routingConfig.strategy,
      );
      if (content) {
        return <DynamicContentClient content={content} />;
      }
    } catch {
      // fall through to the framework default
    }

    return <TokenEmailPreferencesPanel />;
  }
}

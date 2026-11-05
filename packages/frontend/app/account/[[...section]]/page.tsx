import { connection } from 'next/server';
import { AccountShellHost } from '@/app/account/components/view/account-shell-host.client';
import { DynamicContentClient } from '@/app/components/view/dynamic-content-client.client';
import { AccountRouteGuard } from '@/lib/account-route-guard';
import { DynamicPageResolver } from '@/lib/dynamic-page-resolver';
import { QueryParamUtils } from '@/lib/query-param-utils';
import { ThemedRouteMetadata } from '@/lib/themed-route-metadata';

/**
 * `/account` and every `/account/<section>` — where a signed-in customer lands.
 *
 * A theme that seeds an `account` page keeps rendering it (its layout mounts the account shell for that
 * page). A theme that seeds none used to answer 404 here, so a customer who signed in had nowhere to
 * go. The fallback is the framework's own account shell, which builds its sections from whatever the
 * installed plugins register — the same shell a theme layout renders through the bridge.
 *
 * The server-side guard runs first on both paths, as it does in the document route: a guest is
 * redirected to sign in before any markup is produced.
 */
export class AccountPageRoute {
  /** The content slug a theme seeds to brand this route. */
  static readonly PAGE_SLUG = 'account';

  /** The themed page's own title, description and canonical — see `ThemedRouteMetadata`. */
  static async generateMetadata({ searchParams }: { searchParams?: (Record<string, string | string[] | undefined> | Promise<Record<string, string | string[] | undefined>>) } = {}) {
    await connection();
    return ThemedRouteMetadata.build(AccountPageRoute.PAGE_SLUG, searchParams);
  }

  static async render({
    params,
    searchParams,
  }: {
    params: Promise<{ section?: string[] }>;
    searchParams?: (Record<string, string | string[] | undefined> | Promise<Record<string, string | string[] | undefined>>);
  }) {
    // Opt into dynamic rendering without a route-segment `export const`.
    await connection();
    const section = ((await params)?.section || []).map((part) => String(part || '').trim()).filter(Boolean);
    const slug = [AccountPageRoute.PAGE_SLUG, ...section].join('/');
    const resolvedSearchParams = await QueryParamUtils.resolveSearchParams(searchParams);
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(resolvedSearchParams || {})) {
      for (const item of Array.isArray(value) ? value : [value]) if (item !== undefined) query.append(key, item);
    }
    // Outside any try/catch: the guard signals its redirect by throwing.
    await AccountRouteGuard.enforce(`/${slug}`, `/${slug}${query.size ? `?${query.toString()}` : ''}`);

    try {
      const routingConfig = await DynamicPageResolver.getLocaleRoutingConfig();
      const locale = await DynamicPageResolver.resolveLocale(resolvedSearchParams, '', routingConfig.strategy);
      const content = await DynamicPageResolver.resolveDocWithPermalinkFallback(slug, resolvedSearchParams, locale, routingConfig.strategy);
      if (content) {
        return <DynamicContentClient content={content} />;
      }
    } catch {
      // fall through to the framework default
    }
    return <AccountShellHost />;
  }
}

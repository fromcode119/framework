import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { LoginShell } from '@/app/login/components/view/login-shell.client';
import { DynamicContentClient } from '@/app/components/view/dynamic-content-client.client';
import { FrontendAuthUtils } from '@/lib/frontend-auth-settings';
import { DynamicPageResolver } from '@/lib/dynamic-page-resolver';
import { QueryParamUtils } from '@/lib/query-param-utils';
import { ThemedRouteMetadata } from '@/lib/themed-route-metadata';

/**
 * `/login` — where the account guard sends every signed-out visitor.
 *
 * A theme that seeds a `login` page keeps rendering it, exactly as `/register` and `/forgot-password`
 * do. A theme that seeds none used to answer 404 here, so no customer of that site could sign in at
 * all. The fallback is the framework's own sign-in shell — the same one a theme layout renders through
 * the bridge — so the function never depends on the theme: a missing content page degrades the chrome,
 * never the sign-in.
 */
export class LoginPageRoute {
  /** The content slug a theme seeds to brand this route. */
  static readonly PAGE_SLUG = 'login';

  /** The themed page's own title, description and canonical — see `ThemedRouteMetadata`. */
  static async generateMetadata({ searchParams }: { searchParams?: (Record<string, string | string[] | undefined> | Promise<Record<string, string | string[] | undefined>>) } = {}) {
    await connection();
    if (!(await FrontendAuthUtils.isFrontendAuthEnabled())) return {};
    return ThemedRouteMetadata.build(LoginPageRoute.PAGE_SLUG, searchParams);
  }

  static async render({
    searchParams,
  }: {
    searchParams?: (Record<string, string | string[] | undefined> | Promise<Record<string, string | string[] | undefined>>);
  }) {
    // Opt into dynamic rendering without a route-segment `export const`.
    await connection();
    if (!(await FrontendAuthUtils.isFrontendAuthEnabled())) {
      notFound();
    }
    try {
      const resolvedSearchParams = await QueryParamUtils.resolveSearchParams(searchParams);
      const routingConfig = await DynamicPageResolver.getLocaleRoutingConfig();
      const locale = await DynamicPageResolver.resolveLocale(resolvedSearchParams, '', routingConfig.strategy);
      const content = await DynamicPageResolver.resolveDocWithPermalinkFallback(LoginPageRoute.PAGE_SLUG, resolvedSearchParams, locale, routingConfig.strategy);
      if (content) {
        return <DynamicContentClient content={content} />;
      }
    } catch {
      // fall through to the framework default
    }
    return <LoginShell />;
  }
}

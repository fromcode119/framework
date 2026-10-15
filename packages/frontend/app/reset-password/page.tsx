import { connection } from 'next/server';
import { ResetPasswordPage as ResetPasswordClient } from '@/app/reset-password/components/view/reset-password-client.client';
import { DynamicContentClient } from '@/app/components/view/dynamic-content-client.client';
import { FrontendAuthUtils } from '@/lib/frontend-auth-settings';
import { DynamicPageResolver } from '@/lib/dynamic-page-resolver';
import { QueryParamUtils } from '@/lib/query-param-utils';
import { ThemedRouteMetadata } from '@/lib/themed-route-metadata';

export class ResetPasswordPageRoute {
  /** The themed page's own title, description and canonical — see `ThemedRouteMetadata`. */
  static async generateMetadata({ searchParams }: { searchParams?: (Record<string, string | string[] | undefined> | Promise<Record<string, string | string[] | undefined>>) } = {}) {
    await connection();
    return ThemedRouteMetadata.build('reset-password', searchParams);
  }

  static async render({
    searchParams,
  }: {
    searchParams?: (Record<string, string | string[] | undefined> | Promise<Record<string, string | string[] | undefined>>);
  }) {
    // Opt into dynamic rendering without a route-segment `export const`.
    await connection();
    // A reset or email-change link lands here wherever the account is used (the site, an app, the console),
    // so the page is there even when the site offers no sign-in of its own; only its link to the site's
    // own forgot-password page is not.
    const siteSignIn = await FrontendAuthUtils.isFrontendAuthEnabled();
    // Prefer a themed content page (slug 'reset-password') so the active theme fully brands + translates
    // the reset flow; fall back to the framework default client when no themed page is seeded. The
    // themed page reads the `?token=` itself, so the token is preserved through this delegation.
    // Resolved before the themed-page lookup so the framework fallback renders in the same language.
    let locale: string | undefined;
    try {
      const resolvedSearchParams = await QueryParamUtils.resolveSearchParams(searchParams);
      const routingConfig = await DynamicPageResolver.getLocaleRoutingConfig();
      locale = await DynamicPageResolver.resolveLocale(resolvedSearchParams, '', routingConfig.strategy);
      const content = await DynamicPageResolver.resolveDocWithPermalinkFallback('reset-password', resolvedSearchParams, locale, routingConfig.strategy);
      if (content) {
        return <DynamicContentClient content={content} />;
      }
    } catch {
      // fall through to the framework default
    }
    return <ResetPasswordClient locale={locale} siteSignIn={siteSignIn} />;
  }
}

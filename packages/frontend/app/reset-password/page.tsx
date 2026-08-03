import { connection } from 'next/server';
import { notFound } from 'next/navigation';
import { ResetPasswordPage as ResetPasswordClient } from '@/app/reset-password/components/view/reset-password-client.client';
import { DynamicContentClient } from '@/app/components/view/dynamic-content-client.client';
import { FrontendAuthUtils } from '@/lib/frontend-auth-settings';
import { DynamicPageResolver } from '@/lib/dynamic-page-resolver';
import { QueryParamUtils } from '@/lib/query-param-utils';

export class ResetPasswordPageRoute {
  static async render({
    searchParams,
  }: {
    searchParams?: (Record<string, string | string[] | undefined> | Promise<Record<string, string | string[] | undefined>>);
  }) {
    // Opt into dynamic rendering without a route-segment `export const`.
    await connection();
    const authEnabled = await FrontendAuthUtils.isFrontendAuthEnabled();
    if (!authEnabled) {
      notFound();
    }
    // Prefer a themed CMS page (slug 'reset-password') so the active theme fully brands + translates
    // the reset flow; fall back to the framework default client when no themed page is seeded. The
    // themed page reads the `?token=` itself, so the token is preserved through this delegation.
    try {
      const resolvedSearchParams = await QueryParamUtils.resolveSearchParams(searchParams);
      const routingConfig = await DynamicPageResolver.getLocaleRoutingConfig();
      const locale = await DynamicPageResolver.resolveLocale(resolvedSearchParams, '', routingConfig.strategy);
      const content = await DynamicPageResolver.resolveDocWithPermalinkFallback('reset-password', resolvedSearchParams, locale, routingConfig.strategy);
      if (content) {
        return <DynamicContentClient content={content} />;
      }
    } catch {
      // fall through to the framework default
    }
    return <ResetPasswordClient />;
  }
}

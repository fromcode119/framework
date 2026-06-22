import { notFound } from 'next/navigation';
import ResetPasswordClient from './reset-password-client';
import DynamicContentClient from '../dynamic-content-client';
import { FrontendAuthUtils } from '@/lib/frontend-auth-settings';
import { DynamicPageResolver } from '@/lib/dynamic-page-resolver';
import { QueryParamUtils } from '@/lib/query-param-utils';
import type { SearchParams, MaybePromise } from '@/lib/dynamic-page-resolver.types';

export const dynamic = 'force-dynamic';

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams?: MaybePromise<SearchParams>;
}) {
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

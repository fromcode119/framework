import { notFound } from 'next/navigation';
import ForgotPasswordClient from './forgot-password-client';
import DynamicContentClient from '../dynamic-content-client';
import { FrontendAuthUtils } from '@/lib/frontend-auth-settings';
import { DynamicPageResolver } from '@/lib/dynamic-page-resolver';
import { QueryParamUtils } from '@/lib/query-param-utils';
import type { SearchParams, MaybePromise } from '@/lib/dynamic-page-resolver.types';

export const dynamic = 'force-dynamic';

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams?: MaybePromise<SearchParams>;
}) {
  const authEnabled = await FrontendAuthUtils.isFrontendAuthEnabled();
  if (!authEnabled) {
    notFound();
  }
  // Prefer a themed CMS page (slug 'forgot-password') so the active theme fully brands + translates
  // the reset flow; fall back to the framework default client when no themed page is seeded.
  try {
    const resolvedSearchParams = await QueryParamUtils.resolveSearchParams(searchParams);
    const routingConfig = await DynamicPageResolver.getLocaleRoutingConfig();
    const locale = await DynamicPageResolver.resolveLocale(resolvedSearchParams, '', routingConfig.strategy);
    const content = await DynamicPageResolver.resolveDocWithPermalinkFallback('forgot-password', resolvedSearchParams, locale, routingConfig.strategy);
    if (content) {
      return <DynamicContentClient content={content} />;
    }
  } catch {
    // fall through to the framework default
  }
  return <ForgotPasswordClient />;
}

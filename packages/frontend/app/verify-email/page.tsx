import { notFound } from 'next/navigation';
import { LocalizationUtils } from '@fromcode119/core/client';
import VerifyEmailClient from './verify-email-client';
import { FrontendAuthUtils } from '@/lib/frontend-auth-settings';
import { FrontendLocaleService } from '@/lib/frontend-locale-service';
import { QueryParamUtils } from '@/lib/query-param-utils';

export const dynamic = 'force-dynamic';

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const authEnabled = await FrontendAuthUtils.isFrontendAuthEnabled();
  if (!authEnabled) {
    notFound();
  }

  const resolvedSearchParams = await QueryParamUtils.resolveSearchParams(searchParams);
  const defaultLocale = await FrontendLocaleService.readDefaultLocale();
  const requestedLocale = LocalizationUtils.normalizeLocaleCode(
    QueryParamUtils.readSearchValue(resolvedSearchParams, 'locale')
    || QueryParamUtils.readSearchValue(resolvedSearchParams, 'lang'),
    { short: true },
  );

  return <VerifyEmailClient initialLocale={requestedLocale || defaultLocale} />;
}

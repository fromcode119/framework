import { connection } from 'next/server';
import { notFound } from 'next/navigation';
import { LocalizationUtils } from '@fromcode119/core/client';
import { VerifyEmailPage as VerifyEmailClient } from '@/app/verify-email/components/view/verify-email-client.client';
import { FrontendAuthUtils } from '@/lib/frontend-auth-settings';
import { FrontendLocaleService } from '@/lib/frontend-locale-service';
import { QueryParamUtils } from '@/lib/query-param-utils';

export class VerifyEmailPageRoute {
  static async render({
    searchParams,
  }: {
    searchParams?: Promise<Record<string, string | string[] | undefined>>;
  }) {
    // Opt into dynamic rendering without a route-segment `export const`.
    await connection();
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
}

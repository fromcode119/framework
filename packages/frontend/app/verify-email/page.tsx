import { connection } from 'next/server';
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
    // The link in a sign-up email lands here wherever the account was made (the site, an app, the console),
    // so the page is there even when the site offers no sign-in of its own; only its links to it are not.
    const siteSignIn = await FrontendAuthUtils.isFrontendAuthEnabled();
    const siteRegistration = siteSignIn && await FrontendAuthUtils.isFrontendRegistrationEnabled();
    const resolvedSearchParams = await QueryParamUtils.resolveSearchParams(searchParams);
    const defaultLocale = await FrontendLocaleService.readDefaultLocale();
    const requestedLocale = LocalizationUtils.normalizeLocaleCode(
      QueryParamUtils.readSearchValue(resolvedSearchParams, 'locale')
      || QueryParamUtils.readSearchValue(resolvedSearchParams, 'lang'),
      { short: true },
    );
    return <VerifyEmailClient initialLocale={requestedLocale || defaultLocale} siteSignIn={siteSignIn} siteRegistration={siteRegistration} />;
  }
}

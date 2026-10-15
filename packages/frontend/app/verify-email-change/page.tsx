import { connection } from 'next/server';
import { VerifyEmailChangePage as VerifyEmailChangeClient } from '@/app/verify-email-change/components/view/verify-email-change-client.client';
import { FrontendAuthUtils } from '@/lib/frontend-auth-settings';
import { DynamicPageResolver } from '@/lib/dynamic-page-resolver';
import { FrontendLocaleService } from '@/lib/frontend-locale-service';

export class VerifyEmailChangePageRoute {
  static async render() {
  // Opt into dynamic rendering without a route-segment `export const`.
  await connection();
  // A reset or email-change link lands here wherever the account is used (the site, an app, the console),
  // so the page is there even when the site offers no sign-in of its own; only its link to the site's
  // own forgot-password page is not.
  const siteSignIn = await FrontendAuthUtils.isFrontendAuthEnabled();
  // The same locale the document's `<html lang>` is rendered with, so the page and the shell agree.
  const routingConfig = await DynamicPageResolver.getLocaleRoutingConfig();
  const locale = await FrontendLocaleService.resolveDocumentLocale(routingConfig.strategy);
  return <VerifyEmailChangeClient locale={locale} siteSignIn={siteSignIn} />;
}
}

import { notFound } from 'next/navigation';
import { RegisterPage as RegisterClient } from '@/app/register/components/view/register-client.client';
import { FrontendAuthUtils } from '@/lib/frontend-auth-settings';
import { connection } from 'next/server';
import { DynamicContentClient } from '@/app/components/view/dynamic-content-client.client';
import { DynamicPageResolver } from '@/lib/dynamic-page-resolver';

export class RegisterPageRoute {
  static async render() {
  // Opt into dynamic rendering without a route-segment `export const` (see `connection()` docs).
  await connection();
  const [authEnabled, registrationEnabled] = await Promise.all([
    FrontendAuthUtils.isFrontendAuthEnabled(),
    FrontendAuthUtils.isFrontendRegistrationEnabled()
  ]);

  if (!authEnabled || !registrationEnabled) {
    notFound();
  }

  const routingConfig = await DynamicPageResolver.getLocaleRoutingConfig();
  const locale = await DynamicPageResolver.resolveLocale(undefined, '', routingConfig.strategy);
  const content = await DynamicPageResolver.resolveDocWithPermalinkFallback('register', undefined, locale, routingConfig.strategy);
  if (content) {
    return <DynamicContentClient content={content} />;
  }

  return <RegisterClient />;
}
}

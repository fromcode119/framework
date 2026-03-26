import { notFound } from 'next/navigation';
import RegisterClient from './register-client';
import { FrontendAuthUtils } from '@/lib/frontend-auth-settings';
import DynamicContentClient from '../dynamic-content-client';
import { DynamicPageResolver } from '@/lib/dynamic-page-resolver';

export const dynamic = 'force-dynamic';

export default async function RegisterPage() {
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

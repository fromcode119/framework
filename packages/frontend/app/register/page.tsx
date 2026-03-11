import { notFound } from 'next/navigation';
import RegisterClient from './register-client';
import { FrontendAuthUtils } from '@/lib/frontend-auth-settings';

export const dynamic = 'force-dynamic';

export default async function RegisterPage() {
  const [authEnabled, registrationEnabled] = await Promise.all([
    FrontendAuthUtils.isFrontendAuthEnabled(),
    FrontendAuthUtils.isFrontendRegistrationEnabled()
  ]);

  if (!authEnabled || !registrationEnabled) {
    notFound();
  }

  return <RegisterClient />;
}

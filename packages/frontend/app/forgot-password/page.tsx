import { notFound } from 'next/navigation';
import ForgotPasswordClient from './forgot-password-client';
import { FrontendAuthUtils } from '@/lib/frontend-auth-settings';

export const dynamic = 'force-dynamic';

export default async function ForgotPasswordPage() {
  const authEnabled = await FrontendAuthUtils.isFrontendAuthEnabled();
  if (!authEnabled) {
    notFound();
  }
  return <ForgotPasswordClient />;
}

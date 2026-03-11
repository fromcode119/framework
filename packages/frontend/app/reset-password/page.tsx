import { notFound } from 'next/navigation';
import ResetPasswordClient from './reset-password-client';
import { FrontendAuthUtils } from '@/lib/frontend-auth-settings';

export const dynamic = 'force-dynamic';

export default async function ResetPasswordPage() {
  const authEnabled = await FrontendAuthUtils.isFrontendAuthEnabled();
  if (!authEnabled) {
    notFound();
  }
  return <ResetPasswordClient />;
}

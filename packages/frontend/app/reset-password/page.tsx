import { notFound } from 'next/navigation';
import ResetPasswordClient from './reset-password-client';
import { isFrontendAuthEnabled } from '@/lib/frontend-auth-settings';

export const dynamic = 'force-dynamic';

export default async function ResetPasswordPage() {
  const authEnabled = await isFrontendAuthEnabled();
  if (!authEnabled) {
    notFound();
  }
  return <ResetPasswordClient />;
}

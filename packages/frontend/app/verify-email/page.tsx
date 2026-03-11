import { notFound } from 'next/navigation';
import VerifyEmailClient from './verify-email-client';
import { FrontendAuthUtils } from '@/lib/frontend-auth-settings';

export const dynamic = 'force-dynamic';

export default async function VerifyEmailPage() {
  const authEnabled = await FrontendAuthUtils.isFrontendAuthEnabled();
  if (!authEnabled) {
    notFound();
  }
  return <VerifyEmailClient />;
}

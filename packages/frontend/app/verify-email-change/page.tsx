import { notFound } from 'next/navigation';
import VerifyEmailChangeClient from './verify-email-change-client';
import { FrontendAuthUtils } from '@/lib/frontend-auth-settings';

export const dynamic = 'force-dynamic';

export default async function VerifyEmailChangePage() {
  const authEnabled = await FrontendAuthUtils.isFrontendAuthEnabled();
  if (!authEnabled) {
    notFound();
  }
  return <VerifyEmailChangeClient />;
}

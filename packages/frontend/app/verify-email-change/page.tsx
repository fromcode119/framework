import { notFound } from 'next/navigation';
import VerifyEmailChangeClient from './verify-email-change-client';
import { isFrontendAuthEnabled } from '../../lib/frontend-auth-settings';

export const dynamic = 'force-dynamic';

export default async function VerifyEmailChangePage() {
  const authEnabled = await isFrontendAuthEnabled();
  if (!authEnabled) {
    notFound();
  }
  return <VerifyEmailChangeClient />;
}

import { connection } from 'next/server';
import { notFound } from 'next/navigation';
import { VerifyEmailChangePage as VerifyEmailChangeClient } from '@/app/verify-email-change/components/view/verify-email-change-client.client';
import { FrontendAuthUtils } from '@/lib/frontend-auth-settings';

export class VerifyEmailChangePageRoute {
  static async render() {
  // Opt into dynamic rendering without a route-segment `export const`.
  await connection();
  const authEnabled = await FrontendAuthUtils.isFrontendAuthEnabled();
  if (!authEnabled) {
    notFound();
  }
  return <VerifyEmailChangeClient />;
}
}

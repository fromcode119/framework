import React from 'react';
import { redirect } from 'next/navigation';
import { AdminConstants } from '@/lib/constants';

// Next.js App Router route page — must be a function component (RSC pages have no class API).
export default function SettingsPage(): React.ReactNode {
  redirect(AdminConstants.ROUTES.SETTINGS.GENERAL);
  return null;
}

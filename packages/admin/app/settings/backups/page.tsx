import React from 'react';
import { BackupsPageClient } from '@/components/settings/backups/backups-page-client';

// Next.js App Router route page — must be a function component (RSC pages have no class API).
export default function BackupsSettingsPage(): React.ReactNode {
  return <BackupsPageClient />;
}

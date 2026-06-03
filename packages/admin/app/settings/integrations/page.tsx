import React from 'react';
import { IntegrationsSettingsPageClient } from './integrations-settings-page-client';

// Next.js App Router route page — must be a function component (RSC pages have no class API).
export default function IntegrationsSettingsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[]>>;
}): React.ReactNode {
  return <IntegrationsSettingsPageClient searchParams={searchParams} />;
}

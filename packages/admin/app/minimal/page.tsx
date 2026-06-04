import React from 'react';
import { AppPathConstants } from '@fromcode119/core/app-path-constants';
import { redirect } from 'next/navigation';
import { AppEnv } from '@/lib/env';

// Next.js App Router route page — must be a function component (RSC pages have no class API).
export default function MinimalModePage(): React.ReactNode {
  if (!AppEnv.AI_ENABLED) {
    redirect(AppPathConstants.ADMIN.ROOT);
  }

  redirect(AppPathConstants.ADMIN.MINIMAL);
}

import { AppPathConstants } from '@fromcode119/core/client';
import { redirect } from 'next/navigation';
import { AppEnv } from '@/lib/env';

export default function MinimalModePage() {
  if (!AppEnv.AI_ENABLED) {
    redirect(AppPathConstants.ADMIN.ROOT);
  }

  redirect(AppPathConstants.ADMIN.MINIMAL);
}

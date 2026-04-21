import { AppPathConstants } from '@fromcode119/core/client';
import { redirect } from 'next/navigation';
import { ForgeClient } from '../forge/forge-client';
import { AppEnv } from '@/lib/env';

export default function AtlantisPage() {
  if (!AppEnv.AI_ENABLED) {
    redirect(AppPathConstants.ADMIN.ROOT);
  }

  return <ForgeClient />;
}

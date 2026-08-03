import type { ReactNode } from 'react';
import { Reactor } from '@fromcode119/reactor';
import { AppPathConstants } from '@fromcode119/core/constants/app-path.constants';
import { redirect } from 'next/navigation';
import { ForgeClient } from '@/app/forge/components/view/forge-client.client';
import { AppEnv } from '@/lib/env';

/** Admin AI workspace route. */
export class AtlantisPage extends Reactor {
  render(): ReactNode {
    if (!AppEnv.AI_ENABLED) {
      redirect(AppPathConstants.ADMIN.ROOT);
    }

    return <ForgeClient />;
  }
}

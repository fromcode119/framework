import type React from 'react';
import { Reactor } from '@fromcode119/reactor';
import { AppPathConstants } from '@fromcode119/core/constants/app-path.constants';
import { redirect } from 'next/navigation';
import { AppEnv } from '@/lib/env';

/** Admin route. */
export class MinimalModePage extends Reactor {
  render(): React.ReactNode {
    if (!AppEnv.AI_ENABLED) {
      redirect(AppPathConstants.ADMIN.ROOT);
    }

    redirect(AppPathConstants.ADMIN.MINIMAL);
  }
}

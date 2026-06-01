import React from 'react';
import { AppPathConstants } from '@fromcode119/core/client';
import { redirect } from 'next/navigation';
import { AppEnv } from '@/lib/env';

export default class MinimalModePage extends React.Component<{}> {
  render(): React.ReactNode {
  if (!AppEnv.AI_ENABLED) {
    redirect(AppPathConstants.ADMIN.ROOT);
  }

  redirect(AppPathConstants.ADMIN.MINIMAL);
  }
}

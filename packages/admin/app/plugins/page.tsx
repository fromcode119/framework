import type React from 'react';
import { Reactor } from '@fromcode119/reactor';
import { redirect } from 'next/navigation';
import { AdminConstants } from '@/lib/constants/admin.constants';

/** Admin route. */
export class PluginsPage extends Reactor {
  render(): React.ReactNode {
    redirect(AdminConstants.ROUTES.PLUGINS.INSTALLED);
  }
}

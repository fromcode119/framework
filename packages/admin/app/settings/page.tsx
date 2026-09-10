import type { ReactNode } from 'react';
import { Reactor } from '@fromcode119/react-class-components';
import { redirect } from 'next/navigation';
import { AdminConstants } from '@/lib/constants/admin.constants';

/** Admin route. */
export class SettingsPage extends Reactor {
  render(): ReactNode {
    redirect(AdminConstants.ROUTES.SETTINGS.GENERAL);
    return null;
  }
}

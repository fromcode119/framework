import type { ReactNode } from 'react';
import { Reactor } from '@fromcode119/reactor';
import { redirect } from 'next/navigation';
import { AdminConstants } from '@/lib/constants/admin.constants';

/** Admin route. */
export class ThemesPage extends Reactor {
  render(): ReactNode {
    redirect(AdminConstants.ROUTES.THEMES.INSTALLED);
  }
}

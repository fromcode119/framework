import type { ReactNode } from 'react';
import { Reactor } from '@fromcode119/reactor';
import { InstalledThemesPageClient } from '@/app/themes/installed/components/view/page-client.client';

/** Installed themes route. */
export class InstalledThemesPage extends Reactor {
  render(): ReactNode {
    return <InstalledThemesPageClient />;
  }
}

import type { ReactNode } from 'react';
import { Reactor } from '@fromcode119/reactor';
import { BackupsPageClient } from '@/components/settings/backups/view/backups-page-client.client';

/** Backups settings route. */
export class BackupsSettingsPage extends Reactor {
  render(): ReactNode {
    return <BackupsPageClient />;
  }
}

import type { ReactNode } from 'react';
import { PureReactor } from '@fromcode119/react-class-components';
import { EventDeliveriesPageClient } from '@/app/plugins/events/components/view/page-client.client';
import { PlatformScopeGate } from '@/components/view/platform-scope-gate.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

// Next.js App Router route page — client component class (hook-free, reactor OOP).
export class EventDeliveriesPage extends PureReactor {
  render(): ReactNode {
    return (
      <PlatformScopeGate what={AdminI18n.t('plugins.events.title')}>
        <EventDeliveriesPageClient />
      </PlatformScopeGate>
    );
  }
}

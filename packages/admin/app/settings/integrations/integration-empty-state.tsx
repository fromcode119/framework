import type { ReactNode } from 'react';

import { PureReactor } from '@fromcode119/react-class-components';
import { Card } from '@/components/ui/view/card.client';
import { FrameworkIcons } from '@fromcode119/react';
import { EmptyState } from '@/components/ui/view/empty-state.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

export class IntegrationEmptyState extends PureReactor {
  render(): ReactNode {
    return (
      <div className="fc-page-stack">
        <Card>
          <EmptyState
            icon={<FrameworkIcons.Orbit size={22} />}
            title={AdminI18n.t('settings.integrations.noIntegrationTypesRegistered')}
            hint={AdminI18n.t('settings.integrations.registerAtLeastOneIntegration')}
          />
        </Card>
      </div>
    );
  }
}

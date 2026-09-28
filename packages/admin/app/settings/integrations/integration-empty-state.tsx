import type { ReactNode } from 'react';

import { PureReactor } from '@fromcode119/react-class-components';
import { Card } from '@/components/ui/view/card.client';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

export class IntegrationEmptyState extends PureReactor {
  render(): ReactNode {
    return (
      <div className="p-8 lg:p-12">
        <Card className="p-10 text-center">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-xl bg-indigo-50 text-indigo-600 mb-4">
            <FrameworkIcons.Orbit size={22} />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">{AdminI18n.t('settings.integrations.noIntegrationTypesRegistered')}</h2>
          <p className="mt-2 text-sm text-slate-500">
            {AdminI18n.t('settings.integrations.registerAtLeastOneIntegration')}
          </p>
        </Card>
      </div>
    );
  }
}

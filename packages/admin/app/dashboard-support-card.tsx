import { RecordCard } from '@/components/ui/view/record-card.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import type { ReactNode } from 'react';

import { PureReactor, prop } from '@fromcode119/react-class-components';
import { Card } from '@/components/ui/view/card.client';
import { Button } from '@/components/ui/view/button.client';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

export class DashboardSupportCard extends PureReactor {
  @prop declare onNavigateFramework: () => void;

  render(): ReactNode {
    return (
      <RecordCard title={AdminI18n.t('dashboard.support')}>
        <div className="fc-chip-row fc-chip-row--cell">
          <Button variant={ButtonVariant.SECONDARY} as="a" href={AdminConstants.ROUTES.SETTINGS.FRAMEWORK}>
            {AdminI18n.t('dashboard.developerGuide')} <FrameworkIcons.ArrowRight size={14} />
          </Button>
          <Button variant={ButtonVariant.GHOST} as="a" href={AdminConstants.FRAMEWORK_RESOURCES.GITHUB} target="_blank">GitHub</Button>
        </div>
      </RecordCard>
    );
  }
}

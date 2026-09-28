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
      <Card title={AdminI18n.t('dashboard.support')}>
         <div className="space-y-3">
            {/* The hardcoded English marketing pull-quote that used to sit here was copy living in a
                .tsx that no admin field produced and no locale file owned. Dropped rather than
                re-homed: it carried no information the operator could act on. */}
            <Button
              variant={ButtonVariant.SECONDARY}
              className="w-full justify-between group"
              as="a"
              href={AdminConstants.ROUTES.SETTINGS.FRAMEWORK}
            >
               {AdminI18n.t('dashboard.developerGuide')}
               <FrameworkIcons.ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </Button>
            <div className="pt-2 flex items-center justify-center gap-4 text-[10px] font-semibold tracking-wide text-slate-400">
               <a href={AdminConstants.FRAMEWORK_RESOURCES.GITHUB} target="_blank" rel="noopener noreferrer" className="hover:text-indigo-500 transition-colors">GitHub</a>
            </div>
         </div>
      </Card>
    );
  }
}

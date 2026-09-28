import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { BadgeVariant } from '@/components/ui/enums/badge-variant.enum';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { Card } from '@/components/ui/view/card.client';
import { Button } from '@/components/ui/view/button.client';
import { Badge } from '@/components/ui/view/badge.client';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

export class NewRoleSummarySidebar extends PureReactor {
  @prop declare permissionCount: number;
  @prop declare loading: boolean;
  @prop declare onCancel: () => void;

  render(): ReactNode {
    const { permissionCount, loading, onCancel } = this;
    return (
      <div className="lg:col-span-4 space-y-4">
        <Card title={AdminI18n.t('users.summary')}>
          <div className="space-y-3">
            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3.5 border border-slate-100 dark:border-slate-800 space-y-3">
               <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-tight">{AdminI18n.t('users.roleType')}</span>
                  <Badge variant={BadgeVariant.AMBER} className="tracking-tight font-semibold">{AdminI18n.t('users.custom')}</Badge>
               </div>
               <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-tight">{AdminI18n.t('users.scope')}</span>
                  <span className="text-xs font-semibold tracking-tight text-slate-600 dark:text-slate-300">
                    {permissionCount === 0 ? AdminI18n.t('users.noPermissions') : `${permissionCount} selected`}
                  </span>
               </div>
            </div>

            <div className="flex flex-col gap-2">
              <Button
                type="submit"
                className="w-full h-9 text-xs font-semibold rounded-lg text-white"
                isLoading={loading}
                icon={<FrameworkIcons.Check size={15} />}
              >
                {AdminI18n.t('users.saveRole')}
              </Button>
              <Button
                variant={ButtonVariant.GHOST}
                className="w-full h-9 text-xs font-semibold text-slate-500"
                onClick={onCancel}
              >
                {AdminI18n.t('users.cancel')}
              </Button>
            </div>
          </div>
        </Card>

        <Card title={AdminI18n.t('users.help')}>
           <p className="text-xs text-slate-500 leading-relaxed font-medium tracking-tight">
             {AdminI18n.t('users.creatingThisRoleLetsYou')}
           </p>
        </Card>
      </div>
    );
  }
}

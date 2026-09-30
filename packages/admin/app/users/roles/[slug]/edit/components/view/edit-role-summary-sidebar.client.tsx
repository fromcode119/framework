import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { BadgeVariant } from '@/components/ui/enums/badge-variant.enum';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { Card } from '@/components/ui/view/card.client';
import { Button } from '@/components/ui/view/button.client';
import { Badge } from '@/components/ui/view/badge.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

export class EditRoleSummarySidebar extends PureReactor {
  @prop declare type: string;
  @prop declare permissionCount: number;
  @prop declare loading: boolean;
  @prop declare onCancel: () => void;
  /** No Save: this editor may not change the role here (see the notice on the page). */
  @prop declare readOnly?: boolean;

  render(): ReactNode {
    const { type, permissionCount, loading, onCancel } = this;
    return (
      <div className="lg:col-span-4 space-y-8">
        <Card title={AdminI18n.t('users.summary')}>
          <div className="space-y-6">
            <div className="bg-indigo-500/5 rounded-2.5xl p-6 border border-indigo-500/10 space-y-4">
               <div className="flex flex-col gap-1">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">{AdminI18n.t('users.roleType')}</span>
                  <Badge variant={BadgeVariant.AMBER}>{type}</Badge>
               </div>
               <div className="flex flex-col gap-1">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">{AdminI18n.t('users.selectedScope')}</span>
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                    {permissionCount === 0 ? AdminI18n.t('users.noPermissions') : AdminI18n.t('users.actionsSelected', { permissionCount: permissionCount })}
                  </span>
               </div>
            </div>

            {this.readOnly ? null : <Button
              type="submit"
              className="w-full h-11 text-[11px] font-bold uppercase tracking-tight rounded-xl shadow-lg shadow-indigo-600/10 text-white"
              isLoading={loading}
            >
              {AdminI18n.t('users.save')}
            </Button>}
            <Button
              variant={ButtonVariant.GHOST}
              className="w-full h-11 font-bold text-slate-400"
              onClick={onCancel}
            >
              {AdminI18n.t('users.cancel')}
            </Button>
          </div>
        </Card>

        <Card title={AdminI18n.t('users.securityNote')}>
           <p className="text-xs text-slate-500 font-bold leading-relaxed italic">
             {AdminI18n.t('users.changesToRolePermissionsAre')}
           </p>
        </Card>
      </div>
    );
  }
}

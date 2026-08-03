import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { BadgeVariant } from '@/components/ui/enums/badge-variant.enum';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/reactor';
import { Card } from '@/components/ui/view/card.client';
import { Button } from '@/components/ui/view/button.client';
import { Badge } from '@/components/ui/view/badge.client';

export class EditRoleSummarySidebar extends PureReactor {
  @prop declare type: string;
  @prop declare permissionCount: number;
  @prop declare loading: boolean;
  @prop declare onCancel: () => void;

  render(): ReactNode {
    const { type, permissionCount, loading, onCancel } = this;
    return (
      <div className="lg:col-span-4 space-y-8">
        <Card title="Summary">
          <div className="space-y-6">
            <div className="bg-indigo-500/5 rounded-2.5xl p-6 border border-indigo-500/10 space-y-4">
               <div className="flex flex-col gap-1">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Role Type</span>
                  <Badge variant={BadgeVariant.AMBER}>{type}</Badge>
               </div>
               <div className="flex flex-col gap-1">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Selected Scope</span>
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                    {permissionCount === 0 ? 'No permissions' : `${permissionCount} actions selected`}
                  </span>
               </div>
            </div>

            <Button
              type="submit"
              className="w-full h-11 text-[11px] font-bold uppercase tracking-tight rounded-xl shadow-lg shadow-indigo-600/10 text-white"
              isLoading={loading}
            >
              Save
            </Button>
            <Button
              variant={ButtonVariant.GHOST}
              className="w-full h-11 font-bold text-slate-400"
              onClick={onCancel}
            >
              Cancel
            </Button>
          </div>
        </Card>

        <Card title="Security Note">
           <p className="text-xs text-slate-500 font-bold leading-relaxed italic">
             Changes to role permissions are applied immediately. Users currently logged in with this role may need to refresh their session to see changes.
           </p>
        </Card>
      </div>
    );
  }
}

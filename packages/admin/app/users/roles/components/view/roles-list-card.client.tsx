import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { FieldSize } from '@/components/ui/enums/field-size.enum';
import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/reactor';
import { Card } from '@/components/ui/view/card.client';
import { Button } from '@/components/ui/view/button.client';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminConstants } from '@/lib/constants/admin.constants';
import Link from 'next/link';

export class RolesListCard extends PureReactor {
  @prop declare roles: any[];
  @prop declare theme: ThemeMode;
  @prop declare onRequestDelete: (role: any) => void;

  render(): ReactNode {
    const dark = this.theme === ThemeMode.DARK;
    return (
      <Card title="System Roles & Security Groups">
        <div className="space-y-2">
          {this.roles.map((role) => {
            const isSystem = role.type === 'system';
            return (
              <div key={role.slug} className={`flex items-center justify-between gap-4 p-3.5 rounded-xl border transition-colors ${
                dark ? 'bg-slate-950/30 border-slate-800 hover:bg-slate-900/50' : 'bg-white border-slate-200 hover:bg-slate-50'
              }`}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${
                    isSystem ? 'bg-indigo-600 text-white' : (dark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-400')
                  }`}>
                    <FrameworkIcons.Shield size={16} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className={`text-sm font-semibold tracking-tight ${dark ? 'text-white' : 'text-slate-900'}`}>{role.name}</h3>
                      <code className={`text-[10px] font-semibold uppercase tracking-tight px-1.5 py-0.5 rounded ${dark ? 'bg-slate-800 text-slate-500' : 'bg-slate-100 text-slate-500'}`}>{role.slug}</code>
                    </div>
                    <p className="text-xs font-medium text-slate-500 truncate max-w-xl">{role.description || 'No description'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-5 shrink-0">
                  <div className="hidden md:flex items-center gap-5 text-xs font-medium">
                    <span className="text-slate-500"><span className={dark ? 'text-slate-200 font-semibold' : 'text-slate-800 font-semibold'}>{role.users || 0}</span> users</span>
                    <span className="text-indigo-500 font-semibold">{role.permissions?.length || 0} perms</span>
                  </div>
                  {isSystem ? (
                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-500">
                      <FrameworkIcons.Lock size={11} strokeWidth={2} />
                      <span className="font-semibold uppercase tracking-tight text-[10px]">Locked</span>
                    </span>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <Button as={Link} href={AdminConstants.ROUTES.USERS.ROLE_EDIT(role.slug)} variant={ButtonVariant.GHOST} size={FieldSize.ICON} className="h-8 w-8 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-indigo-600">
                        <FrameworkIcons.Edit size={14} />
                      </Button>
                      <Button variant={ButtonVariant.GHOST} size={FieldSize.ICON} onClick={() => this.onRequestDelete(role)} className="h-8 w-8 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-rose-600">
                        <FrameworkIcons.Trash size={14} />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    );
  }
}

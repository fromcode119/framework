import { BadgeVariant } from '@/components/ui/enums/badge-variant.enum';
import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { Card } from '@/components/ui/view/card.client';
import { Badge } from '@/components/ui/view/badge.client';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

export class UserProfileSidebar extends PureReactor {
  @prop declare user: any;
  @prop declare theme: ThemeMode;
  /** Your own account without user management — the role-assignment advice is not for you. */
  @prop declare selfService?: boolean;

  render(): ReactNode {
    const { user, theme } = this;
    return (
      <div className="space-y-8">
        <Card title={AdminI18n.t('users.systemMetadata')}>
          <div className="space-y-6">
             <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold tracking-tight text-slate-500 uppercase">{AdminI18n.t('users.accountType')}</span>
                {user.roles && user.roles.includes('admin') ? (
                   <Badge variant={BadgeVariant.PURPLE} className="px-3 font-bold">{AdminI18n.t('users.administrator')}</Badge>
                ) : (
                   <Badge variant={BadgeVariant.AMBER} className="px-3 font-bold">{AdminI18n.t('users.standard')}</Badge>
                )}
             </div>
             <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold tracking-tight text-slate-500 uppercase">{AdminI18n.t('users.accountStatus')}</span>
                <Badge variant={String(user.accountStatus || 'active').toLowerCase() === 'suspended' ? 'danger' : 'success'} className="px-3 font-bold">
                  {String(user.accountStatus || 'active').toLowerCase() === 'suspended' ? AdminI18n.t('users.suspended') : AdminI18n.t('users.active')}
                </Badge>
             </div>
             <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold tracking-tight text-slate-500 uppercase">{AdminI18n.t('users.passwordReset')}</span>
                <span className="text-xs font-bold text-slate-400">
                  {user.forcePasswordReset ? AdminI18n.t('users.requiredOnNextLogin') : AdminI18n.t('users.notRequired')}
                </span>
             </div>
             {/* Only when known: the account's own endpoint does not carry the dates, and `new Date(undefined)` printed "Invalid Date". */}
             {user.createdAt ? (
             <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold tracking-tight text-slate-500 uppercase">{AdminI18n.t('users.created')}</span>
                <span className="text-xs font-bold text-slate-400">{new Date(user.createdAt).toLocaleDateString()}</span>
             </div>
             ) : null}
             {user.createdAt ? (
             <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold tracking-tight text-slate-500 uppercase">{AdminI18n.t('users.lastModified')}</span>
                <span className="text-xs font-bold text-slate-400">{user.updatedAt ? new Date(user.updatedAt).toLocaleDateString() : AdminI18n.t('users.never')}</span>
             </div>
             ) : null}
          </div>
        </Card>

        {this.selfService ? null : <div className={`p-5 rounded-xl border overflow-hidden relative ${
          theme === ThemeMode.DARK ? 'bg-indigo-500/5 border-indigo-500/20' : 'bg-indigo-50 border-indigo-100'
        }`}>
           <h4 className="text-[11px] font-bold tracking-tight text-indigo-500 mb-2 uppercase">{AdminI18n.t('users.securityNotice')}</h4>
           <p className="text-xs font-bold leading-relaxed text-slate-500">
             {AdminI18n.t('users.modifyingUserRolesOrPermissions')}
           </p>
           <FrameworkIcons.Shield className="absolute -bottom-4 -right-4 text-indigo-500/10" size={100} />
        </div>}
      </div>
    );
  }
}

import { BadgeVariant } from '@/components/ui/enums/badge-variant.enum';
import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/reactor';
import { Card } from '@/components/ui/view/card.client';
import { Badge } from '@/components/ui/view/badge.client';
import { FrameworkIcons } from '@fromcode119/react';

export class UserProfileSidebar extends PureReactor {
  @prop declare user: any;
  @prop declare theme: ThemeMode;

  render(): ReactNode {
    const { user, theme } = this;
    return (
      <div className="space-y-8">
        <Card title="System Metadata">
          <div className="space-y-6">
             <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold tracking-tight text-slate-500 uppercase">Account Type</span>
                {user.roles && user.roles.includes('admin') ? (
                   <Badge variant={BadgeVariant.PURPLE} className="px-3 font-bold">Administrator</Badge>
                ) : (
                   <Badge variant={BadgeVariant.AMBER} className="px-3 font-bold">Standard</Badge>
                )}
             </div>
             <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold tracking-tight text-slate-500 uppercase">Account Status</span>
                <Badge variant={String(user.accountStatus || 'active').toLowerCase() === 'suspended' ? 'danger' : 'success'} className="px-3 font-bold">
                  {String(user.accountStatus || 'active').toLowerCase() === 'suspended' ? 'Suspended' : 'Active'}
                </Badge>
             </div>
             <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold tracking-tight text-slate-500 uppercase">Password Reset</span>
                <span className="text-xs font-bold text-slate-400">
                  {user.forcePasswordReset ? 'Required on next login' : 'Not required'}
                </span>
             </div>
             <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold tracking-tight text-slate-500 uppercase">Created</span>
                <span className="text-xs font-bold text-slate-400">{new Date(user.createdAt).toLocaleDateString()}</span>
             </div>
             <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold tracking-tight text-slate-500 uppercase">Last Modified</span>
                <span className="text-xs font-bold text-slate-400">{user.updatedAt ? new Date(user.updatedAt).toLocaleDateString() : 'Never'}</span>
             </div>
          </div>
        </Card>

        <div className={`p-5 rounded-xl border overflow-hidden relative ${
          theme === ThemeMode.DARK ? 'bg-indigo-500/5 border-indigo-500/20' : 'bg-indigo-50 border-indigo-100'
        }`}>
           <h4 className="text-[11px] font-bold tracking-tight text-indigo-500 mb-2 uppercase">Security Notice</h4>
           <p className="text-xs font-bold leading-relaxed text-slate-500">
             Modifying user roles or permissions takes effect immediately. Ensure you follow the principle of least privilege when assigning administrative roles.
           </p>
           <FrameworkIcons.Shield className="absolute -bottom-4 -right-4 text-indigo-500/10" size={100} />
        </div>
      </div>
    );
  }
}

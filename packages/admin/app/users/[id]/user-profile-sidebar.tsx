'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FrameworkIcons } from '@fromcode119/react';

export class UserProfileSidebar extends React.Component<{ user: any; theme: string }> {
  render(): React.ReactNode {
    const { user, theme } = this.props;
    return (
      <div className="space-y-8">
        <Card title="System Metadata">
          <div className="space-y-6">
             <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold tracking-tight text-slate-500 uppercase">Account Type</span>
                {user.roles && user.roles.includes('admin') ? (
                   <Badge variant="purple" className="px-3 font-bold">Administrator</Badge>
                ) : (
                   <Badge variant="amber" className="px-3 font-bold">Standard</Badge>
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

        <div className={`p-8 rounded-[2rem] border overflow-hidden relative ${
          theme === 'dark' ? 'bg-indigo-500/5 border-indigo-500/20' : 'bg-indigo-50 border-indigo-100'
        }`}>
           <h4 className="text-[11px] font-bold tracking-tight text-indigo-500 mb-4 uppercase">Security Notice</h4>
           <p className="text-xs font-bold leading-relaxed text-slate-500">
             Modifying user roles or permissions takes effect immediately. Ensure you follow the principle of least privilege when assigning administrative roles.
           </p>
           <FrameworkIcons.Shield className="absolute -bottom-4 -right-4 text-indigo-500/10" size={100} />
        </div>
      </div>
    );
  }
}

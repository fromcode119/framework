'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminConstants } from '@/lib/constants';
import Link from 'next/link';

export class UserProfileHeader extends React.Component<{
  theme: string;
  user: any;
  userId: string;
  initials: string;
}> {
  render(): React.ReactNode {
    const { theme, user, userId, initials } = this.props;
    return (
      <div className={`sticky top-0 z-40 border-b backdrop-blur-3xl ${
        theme === 'dark' ? 'bg-slate-950/80 border-slate-800/50 shadow-2xl' : 'bg-white/80 border-slate-100 shadow-sm'
      }`}>
        <div className="w-full px-6 lg:px-12 py-8 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href={AdminConstants.ROUTES.USERS.LIST} className={`p-2 rounded-xl transition-all ${theme === 'dark' ? 'hover:bg-slate-800 text-slate-500' : 'hover:bg-slate-50 text-slate-400'}`}>
              <FrameworkIcons.Left size={20} />
            </Link>
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-tr from-indigo-500 to-indigo-600 flex items-center justify-center text-xl font-bold text-white shadow-xl shadow-indigo-500/20 ring-4 ring-indigo-500/10">
              {initials}
            </div>
            <div>
              <h1 className={`text-2xl font-bold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                {user.firstName ? `${user.firstName} ${user.lastName}` : user.email.split('@')[0]}
              </h1>
              <div className="flex items-center gap-4 mt-1">
                <span className="text-[10px] font-bold tracking-tight text-slate-500">{user.email}</span>
                <Badge variant="blue" className="text-[8px] px-2 py-0 border-none font-bold">ID: {user.id}</Badge>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
             <Link href={AdminConstants.ROUTES.USERS.EDIT(userId)}>
                <Button
                  variant="secondary"
                  className="px-6 h-11 rounded-xl font-bold tracking-tight text-[11px] border-slate-200 dark:border-slate-800"
                  icon={<FrameworkIcons.Settings size={16} />}
                >
                  Edit Profile
                </Button>
             </Link>
             <Link href={AdminConstants.ROUTES.USERS.ROLES(userId)}>
                <Button
                  className="px-6 h-11 rounded-xl font-bold tracking-tight text-[11px] text-white"
                  icon={<FrameworkIcons.Shield size={16} />}
                >
                  Configure RBAC
                </Button>
             </Link>
          </div>
        </div>
      </div>
    );
  }
}

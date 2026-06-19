'use client';

import React from 'react';
import { Slot } from '@fromcode119/react';
import { FrameworkIcons } from '@fromcode119/react';
import { Button } from '@/components/ui/button';
import { AdminConstants } from '@/lib/constants';
import Link from 'next/link';

export class UsersPageHeader extends React.Component<{ theme: string }> {
  render(): React.ReactNode {
    const { theme } = this.props;
    return (
      <div className={`sticky top-0 z-40 border-b backdrop-blur-3xl transition-all duration-300 ${
        theme === 'dark'
          ? 'bg-slate-950/80 border-slate-800/50 shadow-2xl shadow-black/20'
          : 'bg-white/80 border-slate-100 shadow-sm'
      }`}>
        <div className="w-full px-6 lg:px-12 py-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className={`h-11 w-11 rounded-2xl flex items-center justify-center shadow-lg transform -rotate-3 transition-transform hover:rotate-0 ${
                theme === 'dark' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-600 text-white'
              }`}>
                <FrameworkIcons.Users size={20} strokeWidth={2} />
              </div>
              <h1 className={`text-3xl font-bold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                Users
              </h1>
            </div>
            <p className="text-slate-500 font-bold text-sm tracking-tight opacity-70">
              Manage your users and their assigned roles.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <Slot name="admin.users.list.header.actions" />
            <Link href={AdminConstants.ROUTES.USERS.NEW}>
              <Button
                variant="secondary"
                className="h-11 px-6 rounded-xl font-bold tracking-tight text-xs border-slate-200 dark:border-slate-800"
                icon={<FrameworkIcons.Plus size={16} />}
              >
                Create User
              </Button>
            </Link>
            <Link href={AdminConstants.ROUTES.USERS.ROLE_LIST}>
              <Button
                className="h-11 px-6 rounded-xl font-bold tracking-tight text-xs shadow-lg shadow-indigo-600/10 text-white"
                icon={<FrameworkIcons.Shield size={16} strokeWidth={2} />}
              >
                Manage Roles
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }
}

'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminConstants } from '@/lib/constants';
import Link from 'next/link';
import type { RolesListCardProps } from './roles-list-card.interfaces';

export class RolesListCard extends React.Component<RolesListCardProps> {
  render(): React.ReactNode {
    const { roles, theme, onRequestDelete } = this.props;
    return (
      <Card title="System Roles & Security Groups">
        <div className="grid grid-cols-1 gap-4">
          {roles.map((role) => (
            <div key={role.slug} className={`group p-4 md:p-5 rounded-2xl border transition-all duration-500 ${
              theme === 'dark'
                ? 'bg-slate-950/40 border-slate-800/50 hover:border-indigo-500/30'
                : 'bg-white border-slate-200/60 hover:border-indigo-500/40 hover:shadow-[0_20px_50px_-12px_rgba(79,70,229,0.1)]'
            }`}>
              <div className="flex flex-col lg:flex-row items-start justify-between gap-4">
                <div className="flex flex-col sm:flex-row gap-4 w-full">
                  <div className={`h-12 w-12 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-500 group-hover:scale-110 group-hover:rotate-6 shadow-2xl ${
                    role.type === 'system'
                      ? (theme === 'dark' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-600 text-white shadow-indigo-600/30')
                      : (theme === 'dark' ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500')
                  }`}>
                    <FrameworkIcons.Shield size={22} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <h3 className={`font-bold text-lg tracking-tight transition-colors group-hover:text-indigo-600 ${theme === 'dark' ? 'text-white group-hover:text-indigo-400' : 'text-slate-900'}`}>{role.name}</h3>
                      <code className={`text-[10px] font-bold uppercase tracking-tight px-3 py-1 rounded-full ${
                        theme === 'dark' ? 'bg-slate-800 text-slate-500' : 'bg-slate-50 border border-slate-200 text-slate-500'
                      }`}>
                        {role.slug}
                      </code>
                    </div>
                    <p className="text-sm font-bold text-slate-500 leading-relaxed max-w-2xl mb-4">{role.description}</p>

                    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                       <div className="flex flex-col gap-1">
                         <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Active Members</span>
                         <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{role.users || 0} Users</span>
                       </div>
                       <div className="flex flex-col gap-1">
                         <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Scope</span>
                         <div className="flex gap-2">
                           <span className="text-[11px] font-bold text-indigo-500/80">
                             {role.permissions?.length || 0} Permissions
                           </span>
                         </div>
                       </div>
                       <div className="flex flex-col gap-1">
                         <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Last Modified</span>
                         <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                           {role.updatedAt ? new Date(role.updatedAt).toLocaleDateString() : 'Initial'}
                         </span>
                       </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-row lg:flex-col items-center lg:items-end gap-2 w-full lg:w-auto">
                  {role.type === 'system' ? (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
                       <FrameworkIcons.Lock size={12} strokeWidth={2} />
                       <span className="font-bold uppercase tracking-tight text-[10px]">Immutable</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Button
                        as={Link}
                        href={AdminConstants.ROUTES.USERS.ROLE_EDIT(role.slug)}
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm text-slate-600 hover:text-indigo-600 hover:border-indigo-500/50"
                      >
                        <FrameworkIcons.Edit size={16} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onRequestDelete(role)}
                        className="h-9 w-9 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm text-slate-600 hover:text-rose-600 hover:border-rose-500/50"
                      >
                        <FrameworkIcons.Trash size={16} />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    );
  }
}

'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { FrameworkIcons } from '@fromcode119/react';
import type { User } from './users-page.interfaces';

function getInitials(user: User): string {
  if (user.firstName && user.lastName) return `${user.firstName[0]}${user.lastName[0]}`;
  return user.email[0].toUpperCase();
}

function getDisplayName(user: User): string {
  if (user.firstName && user.lastName) return `${user.firstName} ${user.lastName}`;
  return user.email.split('@')[0];
}

function getRoles(user: User): string[] {
  return Array.isArray(user.roles) ? user.roles : [];
}

export function buildUsersColumns(theme: string): any[] {
  return [
    {
      header: 'User',
      id: 'user',
      accessor: (user: User) => (
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-indigo-500 to-indigo-600 overflow-hidden flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-600/20">
            {getInitials(user)}
          </div>
          <div>
            <div className={`font-bold tracking-tight ${theme === 'dark' ? 'text-slate-200' : 'text-slate-900'}`}>{getDisplayName(user)}</div>
            <div className="text-[11px] font-bold tracking-tight text-slate-500 flex items-center gap-1 opacity-70">
              <FrameworkIcons.Mail size={12} /> {user.email}
            </div>
          </div>
        </div>
      )
    },
    {
      header: 'Roles',
      id: 'roles',
      accessor: (user: User) => (
        <div className="flex flex-wrap gap-1">
          {getRoles(user).map(role => (
            <Badge key={role} variant={role === 'admin' ? 'purple' : 'blue'} className="font-bold tracking-tight">
              {role}
            </Badge>
          ))}
        </div>
      )
    },
    {
      header: 'Status',
      id: 'status',
      accessor: (user: User) => (
        <div className="flex items-center gap-2">
          {String(user.accountStatus || 'active').toLowerCase() === 'suspended' ? (
            <>
              <div className="h-2 w-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]" />
              <span className="font-bold text-rose-500 text-[11px] tracking-tight">Suspended</span>
            </>
          ) : (
            <>
              <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
              <span className="font-bold text-emerald-500 text-[11px] tracking-tight">Active</span>
            </>
          )}
          {user.forcePasswordReset ? (
            <span className="font-bold text-amber-500 text-[10px] tracking-tight uppercase">Reset Required</span>
          ) : null}
        </div>
      )
    },
    {
      header: 'Joined',
      id: 'createdAt',
      accessor: (user: User) => (
        <div className="flex items-center gap-2 font-bold text-[11px] tracking-tight text-slate-500">
          <FrameworkIcons.Calendar size={14} className="opacity-50" />
          {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Initial'}
        </div>
      )
    }
  ];
}

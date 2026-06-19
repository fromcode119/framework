'use client';

import React from 'react';
import { Slot } from '@fromcode119/react';
import { FrameworkIcons } from '@fromcode119/react';
import { Dropdown } from '@/components/ui/dropdown';
import { AdminConstants } from '@/lib/constants';
import type { User } from './users-page.interfaces';

export class UsersRowActions extends React.Component<{
  user: User;
  theme: string;
  onNavigate: (href: string) => void;
  onRequestDelete: (user: User) => void;
}> {
  render(): React.ReactNode {
    const { user, theme, onNavigate, onRequestDelete } = this.props;
    return (
      <div className="flex items-center justify-end gap-2">
        <Slot name="admin.users.list.table.actions" props={{ user }} />
        <Dropdown
          trigger={
            <button className={`h-9 w-9 flex items-center justify-center rounded-xl transition-all ${theme === 'dark' ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : 'hover:bg-indigo-50 text-slate-400 hover:text-indigo-600'}`}>
              <FrameworkIcons.MoreVertical size={16} strokeWidth={2.5} />
            </button>
          }
          items={[
            {
              label: 'View Profile',
              icon: <FrameworkIcons.Users size={16} />,
              onClick: () => onNavigate(AdminConstants.ROUTES.USERS.DETAIL(user.id))
            },
            {
              label: 'Edit Account',
              icon: <FrameworkIcons.Settings size={16} />,
              onClick: () => onNavigate(AdminConstants.ROUTES.USERS.EDIT(user.id))
            },
            {
              label: 'Manage Roles',
              icon: <FrameworkIcons.Shield size={16} />,
              onClick: () => onNavigate(AdminConstants.ROUTES.USERS.ROLES(user.id))
            },
            {
              label: 'Security & 2FA',
              icon: <FrameworkIcons.ShieldCheck size={16} />,
              onClick: () => onNavigate(AdminConstants.ROUTES.USERS.SECURITY(user.id))
            },
            {
              label: 'Login History',
              icon: <FrameworkIcons.Activity size={16} />,
              onClick: () => onNavigate(AdminConstants.ROUTES.USERS.AUTH_ACTIVITY(user.id))
            },
            {
              label: 'Remove User',
              icon: <FrameworkIcons.Warning size={16} />,
              variant: 'danger',
              onClick: () => onRequestDelete(user)
            }
          ]}
        />
      </div>
    );
  }
}

import { ThemeMode } from '@fromcode119/core/client';
import type React from 'react';
import { PureReactor, prop } from '@fromcode119/reactor';
import { Slot } from '@fromcode119/react';
import { FrameworkIcons } from '@fromcode119/react';
import { Dropdown } from '@/components/ui/view/dropdown.client';
import { AdminConstants } from '@/lib/constants/admin.constants';
import type { IUser } from '@/app/users/interfaces/user.interface';

export class UsersRowActions extends PureReactor {
  /** JSX props — the declared @prop fields, so call sites are type-checked without a <Props> generic. */
  declare props: Pick<UsersRowActions, 'user' | 'theme' | 'onNavigate' | 'onRequestDelete'>;

  @prop declare user: IUser;
  @prop declare theme: ThemeMode;
  @prop declare onNavigate: (href: string) => void;
  @prop declare onRequestDelete: (user: IUser) => void;

  render(): React.ReactNode {
    const { user, theme, onNavigate, onRequestDelete } = this;
    return (
      <div className="flex items-center justify-end gap-2">
        <Slot name="admin.users.list.table.actions" props={{ user }} />
        <Dropdown
          trigger={
            <button className={`h-9 w-9 flex items-center justify-center rounded-xl transition-all ${theme === ThemeMode.DARK ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : 'hover:bg-indigo-50 text-slate-400 hover:text-indigo-600'}`}>
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

import { ThemeMode } from '@fromcode119/core/client';
import type React from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { Slot } from '@fromcode119/react';
import { FrameworkIcons } from '@fromcode119/react';
import { Dropdown } from '@/components/ui/view/dropdown.client';
import { AdminConstants } from '@/lib/constants/admin.constants';
import type { IUser } from '@/app/users/interfaces/user.interface';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { AdminClass } from '@/lib/admin-class';
import { HorizontalAlign } from '@/components/ui/enums/horizontal-align.enum';

export class UsersRowActions extends PureReactor {
  /** JSX props — the declared @prop fields, so call sites are type-checked without a <Props> generic. */
  declare props: Pick<UsersRowActions, 'user' | 'theme' | 'onNavigate' | 'onRequestDelete'>;

  @prop declare user: IUser;
  @prop declare theme: ThemeMode;
  @prop declare onNavigate: (href: string) => void;
  @prop declare onRequestDelete: (user: IUser) => void;

  render(): React.ReactNode {
    const { user, onNavigate, onRequestDelete } = this;
    return (
      <>
        <Slot name="admin.users.list.table.actions" props={{ user }} />
        <Dropdown
          align={HorizontalAlign.RIGHT}
          trigger={
            <span aria-label={AdminI18n.t('common.more')} className={AdminClass.of('ext-row__more')}>
              <FrameworkIcons.More size={16} />
            </span>
          }
          items={[
            {
              label: AdminI18n.t('users.viewProfile'),
              icon: <FrameworkIcons.Users size={16} />,
              onClick: () => onNavigate(AdminConstants.ROUTES.USERS.DETAIL(user.id))
            },
            {
              label: AdminI18n.t('users.editAccount'),
              icon: <FrameworkIcons.Settings size={16} />,
              onClick: () => onNavigate(AdminConstants.ROUTES.USERS.EDIT(user.id))
            },
            {
              label: AdminI18n.t('users.manageRoles'),
              icon: <FrameworkIcons.Shield size={16} />,
              onClick: () => onNavigate(AdminConstants.ROUTES.USERS.ROLES(user.id))
            },
            {
              label: AdminI18n.t('users.security2fa'),
              icon: <FrameworkIcons.ShieldCheck size={16} />,
              onClick: () => onNavigate(AdminConstants.ROUTES.USERS.SECURITY(user.id))
            },
            {
              label: AdminI18n.t('users.loginHistory'),
              icon: <FrameworkIcons.Activity size={16} />,
              onClick: () => onNavigate(AdminConstants.ROUTES.USERS.AUTH_ACTIVITY(user.id))
            },
            {
              label: AdminI18n.t('users.removeUser'),
              icon: <FrameworkIcons.Warning size={16} />,
              variant: 'danger',
              onClick: () => onRequestDelete(user)
            }
          ]}
        />
      </>
    );
  }
}

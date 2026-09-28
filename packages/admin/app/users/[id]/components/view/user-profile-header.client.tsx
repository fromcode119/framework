import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { Button } from '@/components/ui/view/button.client';
import { FrameworkIcons } from '@fromcode119/react';
import { CompactPageHeader } from '@/components/ui/view/compact-page-header.client';
import { AdminConstants } from '@/lib/constants/admin.constants';
import Link from 'next/link';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

export class UserProfileHeader extends PureReactor {
  @prop declare theme: ThemeMode;
  @prop declare user: any;
  @prop declare userId: string;
  @prop declare initials: string;
  /** Your own account without user management: no user list to go back to, no role controls. */
  @prop declare selfService?: boolean;

  render(): ReactNode {
    const { theme, user, userId } = this;
    return (
      <CompactPageHeader
        theme={theme}
        backHref={this.selfService ? AdminConstants.ROUTES.ROOT : AdminConstants.ROUTES.USERS.LIST}
        icon={<FrameworkIcons.User size={18} />}
        title={user.firstName ? `${user.firstName} ${user.lastName}` : user.email.split('@')[0]}
        subtitle={`${user.email} · ID: ${user.id}`}
        actions={
          <>
            <Link href={AdminConstants.ROUTES.USERS.EDIT(userId)}>
              <Button
                variant={ButtonVariant.SECONDARY}
                className="px-4 h-9 rounded-lg font-semibold text-xs"
                icon={<FrameworkIcons.Settings size={15} />}
              >
                {AdminI18n.t('users.editProfile')}
              </Button>
            </Link>
            {this.selfService ? (
              <Link href={AdminConstants.ROUTES.USERS.SECURITY(userId)}>
                <Button
                  className="px-4 h-9 rounded-lg font-semibold text-xs text-white"
                  icon={<FrameworkIcons.Shield size={15} />}
                >
                  {AdminI18n.t('users.security')}
                </Button>
              </Link>
            ) : (
              <Link href={AdminConstants.ROUTES.USERS.ROLES(userId)}>
                <Button
                  className="px-4 h-9 rounded-lg font-semibold text-xs text-white"
                  icon={<FrameworkIcons.Shield size={15} />}
                >
                  {AdminI18n.t('users.configureRbac')}
                </Button>
              </Link>
            )}
          </>
        }
      />
    );
  }
}

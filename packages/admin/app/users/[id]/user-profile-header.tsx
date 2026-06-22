'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { FrameworkIcons } from '@fromcode119/react';
import { CompactPageHeader } from '@/components/ui/compact-page-header';
import { AdminConstants } from '@/lib/constants';
import Link from 'next/link';

export class UserProfileHeader extends React.Component<{
  theme: string;
  user: any;
  userId: string;
  initials: string;
}> {
  render(): React.ReactNode {
    const { theme, user, userId } = this.props;
    return (
      <CompactPageHeader
        theme={theme}
        backHref={AdminConstants.ROUTES.USERS.LIST}
        icon={<FrameworkIcons.User size={18} />}
        title={user.firstName ? `${user.firstName} ${user.lastName}` : user.email.split('@')[0]}
        subtitle={`${user.email} · ID: ${user.id}`}
        actions={
          <>
            <Link href={AdminConstants.ROUTES.USERS.EDIT(userId)}>
              <Button
                variant="secondary"
                className="px-4 h-9 rounded-lg font-semibold text-xs"
                icon={<FrameworkIcons.Settings size={15} />}
              >
                Edit profile
              </Button>
            </Link>
            <Link href={AdminConstants.ROUTES.USERS.ROLES(userId)}>
              <Button
                className="px-4 h-9 rounded-lg font-semibold text-xs text-white"
                icon={<FrameworkIcons.Shield size={15} />}
              >
                Configure RBAC
              </Button>
            </Link>
          </>
        }
      />
    );
  }
}

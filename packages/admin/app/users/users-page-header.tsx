'use client';

import React from 'react';
import { Slot } from '@fromcode119/react';
import { FrameworkIcons } from '@fromcode119/react';
import { Button } from '@/components/ui/button';
import { CompactPageHeader } from '@/components/ui/compact-page-header';
import { AdminConstants } from '@/lib/constants';
import Link from 'next/link';

export class UsersPageHeader extends React.Component<{ theme: string }> {
  render(): React.ReactNode {
    const { theme } = this.props;
    return (
      <CompactPageHeader
        theme={theme}
        icon={<FrameworkIcons.Users size={18} strokeWidth={2} />}
        title="Users"
        subtitle="Manage your users and their assigned roles."
        actions={
          <>
            <Slot name="admin.users.list.header.actions" />
            <Link href={AdminConstants.ROUTES.USERS.NEW}>
              <Button
                variant="secondary"
                className="h-9 px-4 rounded-lg font-semibold tracking-tight text-xs border-slate-200 dark:border-slate-800"
                icon={<FrameworkIcons.Plus size={15} />}
              >
                Create User
              </Button>
            </Link>
            <Link href={AdminConstants.ROUTES.USERS.ROLE_LIST}>
              <Button
                className="h-9 px-4 rounded-lg font-semibold tracking-tight text-xs text-white"
                icon={<FrameworkIcons.Shield size={15} strokeWidth={2} />}
              >
                Manage Roles
              </Button>
            </Link>
          </>
        }
      />
    );
  }
}

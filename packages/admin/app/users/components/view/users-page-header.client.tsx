import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/reactor';
import { Slot } from '@fromcode119/react';
import { FrameworkIcons } from '@fromcode119/react';
import { Button } from '@/components/ui/view/button.client';
import { CompactPageHeader } from '@/components/ui/view/compact-page-header.client';
import { AdminConstants } from '@/lib/constants/admin.constants';
import Link from 'next/link';

export class UsersPageHeader extends PureReactor {
  @prop declare theme: ThemeMode;

  render(): ReactNode {
    return (
      <CompactPageHeader
        theme={this.theme}
        icon={<FrameworkIcons.Users size={18} strokeWidth={2} />}
        title="Users"
        subtitle="Manage your users and their assigned roles."
        actions={
          <>
            <Slot name="admin.users.list.header.actions" />
            <Link href={AdminConstants.ROUTES.USERS.NEW}>
              <Button
                variant={ButtonVariant.SECONDARY}
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

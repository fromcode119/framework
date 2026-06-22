'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { CompactPageHeader } from '@/components/ui/compact-page-header';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminConstants } from '@/lib/constants';

export class EditUserHeader extends React.Component<{
  theme: string;
  userId: string;
  saving: boolean;
  onCancel: () => void;
  onSubmit: (e: React.FormEvent) => void;
}> {
  render(): React.ReactNode {
    const { theme, userId, saving, onCancel, onSubmit } = this.props;
    return (
      <CompactPageHeader
        theme={theme}
        backHref={AdminConstants.ROUTES.USERS.DETAIL(userId)}
        title="Edit account"
        subtitle="Update profile information and security credentials."
        actions={
          <>
            <Button variant="ghost" className="px-4 h-9 rounded-lg font-semibold text-xs" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              className="px-4 h-9 rounded-lg font-semibold text-xs text-white"
              icon={<FrameworkIcons.Check size={15} />}
              isLoading={saving}
              onClick={(e: React.FormEvent) => onSubmit(e)}
            >
              Save changes
            </Button>
          </>
        }
      />
    );
  }
}

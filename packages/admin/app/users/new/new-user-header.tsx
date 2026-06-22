'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { FrameworkIcons } from '@fromcode119/react';
import { CompactPageHeader } from '@/components/ui/compact-page-header';
import type { NewUserHeaderProps } from './new-user-header.interfaces';

export class NewUserHeader extends React.Component<NewUserHeaderProps> {
  render(): React.ReactNode {
    const { theme, saving, onCancel, onSubmit } = this.props;
    return (
      <CompactPageHeader
        theme={theme}
        backHref="/users"
        title="Create user"
        subtitle="Create a user account and assign roles."
        actions={
          <>
            <Button
              variant="ghost"
              className="px-4 h-9 rounded-lg font-semibold text-xs"
              onClick={onCancel}
            >
              Cancel
            </Button>
            <Button
              className="px-4 h-9 rounded-lg font-semibold text-xs text-white"
              icon={<FrameworkIcons.Check size={15} />}
              isLoading={saving}
              onClick={(e: React.FormEvent) => onSubmit(e)}
            >
              Create user
            </Button>
          </>
        }
      />
    );
  }
}

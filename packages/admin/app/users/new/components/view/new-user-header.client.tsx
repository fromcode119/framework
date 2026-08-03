import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { ThemeMode } from '@fromcode119/core/client';
import type { FormEvent, ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/reactor';
import { Button } from '@/components/ui/view/button.client';
import { FrameworkIcons } from '@fromcode119/react';
import { CompactPageHeader } from '@/components/ui/view/compact-page-header.client';

export class NewUserHeader extends PureReactor {
  @prop declare theme: ThemeMode;
  @prop declare saving: boolean;
  @prop declare onCancel: () => void;
  @prop declare onSubmit: (e: FormEvent) => void;

  render(): ReactNode {
    return (
      <CompactPageHeader
        theme={this.theme}
        backHref="/users"
        title="Create user"
        subtitle="Create a user account and assign roles."
        actions={
          <>
            <Button
              variant={ButtonVariant.GHOST}
              className="px-4 h-9 rounded-lg font-semibold text-xs"
              onClick={this.onCancel}
            >
              Cancel
            </Button>
            <Button
              className="px-4 h-9 rounded-lg font-semibold text-xs text-white"
              icon={<FrameworkIcons.Check size={15} />}
              isLoading={this.saving}
              onClick={(e: FormEvent) => this.onSubmit(e)}
            >
              Create user
            </Button>
          </>
        }
      />
    );
  }
}

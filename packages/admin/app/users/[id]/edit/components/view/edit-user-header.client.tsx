import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { ThemeMode } from '@fromcode119/core/client';
import type { FormEvent, ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { Button } from '@/components/ui/view/button.client';
import { CompactPageHeader } from '@/components/ui/view/compact-page-header.client';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

export class EditUserHeader extends PureReactor {
  /** JSX props — the declared @prop fields, so call sites are type-checked without a <Props> generic. */
  declare props: Pick<EditUserHeader, 'theme' | 'userId' | 'saving' | 'onCancel' | 'onSubmit'>;

  @prop declare theme: ThemeMode;
  @prop declare userId: string;
  @prop declare saving: boolean;
  @prop declare onCancel: () => void;
  @prop declare onSubmit: (e: FormEvent) => void;

  render(): ReactNode {
    return (
      <CompactPageHeader
        theme={this.theme}
        backHref={AdminConstants.ROUTES.USERS.DETAIL(this.userId)}
        title={AdminI18n.t('users.editAccount2')}
        subtitle={AdminI18n.t('users.updateProfileInformationAndSecurity')}
        actions={
          <>
            <Button variant={ButtonVariant.GHOST} className="px-4 h-9 rounded-lg font-semibold text-xs" onClick={this.onCancel}>
              {AdminI18n.t('users.cancel')}
            </Button>
            <Button
              className="px-4 h-9 rounded-lg font-semibold text-xs text-white"
              icon={<FrameworkIcons.Check size={15} />}
              isLoading={this.saving}
              onClick={(e: FormEvent) => this.onSubmit(e)}
            >
              {AdminI18n.t('users.saveChanges')}
            </Button>
          </>
        }
      />
    );
  }
}

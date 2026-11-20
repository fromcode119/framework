import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { CompactPageHeader } from '@/components/ui/view/compact-page-header.client';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/** The edit page's head. Edits are saved from the page's save bar, so the head carries no Save. */
export class EditUserHeader extends PureReactor {
  /** JSX props — the declared @prop fields, so call sites are type-checked without a <Props> generic. */
  declare props: Pick<EditUserHeader, 'theme' | 'userId'>;

  @prop declare theme: ThemeMode;
  @prop declare userId: string;

  render(): ReactNode {
    return (
      <CompactPageHeader
        theme={this.theme}
        backHref={AdminConstants.ROUTES.USERS.DETAIL(this.userId)}
        title={AdminI18n.t('users.editAccount2')}
        subtitle={AdminI18n.t('users.updateProfileInformationAndSecurity')}
      />
    );
  }
}

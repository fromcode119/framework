import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { CompactPageHeader } from '@/components/ui/view/compact-page-header.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

export class UserSecurityHeader extends PureReactor {
  @prop declare backHref: string;
  @prop declare email: string;
  @prop declare isDark: boolean;

  render(): ReactNode {
    return (
      <CompactPageHeader
        theme={this.isDark ? 'dark' : 'light'}
        backHref={this.backHref}
        title={AdminI18n.t('users.securityTwoFactorAuthentication')}
        subtitle={this.email}
      />
    );
  }
}

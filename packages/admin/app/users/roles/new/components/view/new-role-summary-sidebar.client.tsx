import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { EditRoleSummarySidebar } from '@/app/users/roles/[slug]/edit/components/view/edit-role-summary-sidebar.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/** The summary beside a role being created: the same card the editor shows, with this page's words. */
export class NewRoleSummarySidebar extends PureReactor {
  @prop declare permissionCount: number;
  @prop declare loading: boolean;
  @prop declare onCancel: () => void;

  render(): ReactNode {
    return (
      <EditRoleSummarySidebar
        type={AdminI18n.t('users.custom')}
        permissionCount={this.permissionCount}
        loading={this.loading}
        onCancel={this.onCancel}
        saveLabel={AdminI18n.t('users.saveRole')}
        tipLabel={AdminI18n.t('users.help')}
        tip={AdminI18n.t('users.creatingThisRoleLetsYou')}
      />
    );
  }
}

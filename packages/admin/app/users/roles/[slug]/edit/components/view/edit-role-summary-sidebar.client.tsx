import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { RecordCard } from '@/components/ui/view/record-card.client';
import { AdminFactGrid } from '@/components/ui/view/admin-fact-grid.client';
import { InlineTip } from '@/components/ui/view/inline-tip.client';
import { Button } from '@/components/ui/view/button.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

export class EditRoleSummarySidebar extends PureReactor {
  @prop declare type: string;
  @prop declare permissionCount: number;
  @prop declare loading?: boolean;
  /** Given only while a role is being CREATED: an existing role is saved from the page's save bar, so
      its summary carries no buttons. */
  @prop declare onCancel?: () => void;
  /** No Save: this editor may not change the role here (see the notice on the page). */
  @prop declare readOnly?: boolean;
  /** The words on the save button and the tip under it, when they are not the editor's own. */
  @prop declare saveLabel?: string;
  @prop declare tipLabel?: string;
  @prop declare tip?: string;

  render(): ReactNode {
    const { type, permissionCount, loading, onCancel } = this;
    return (
      <div className="lg:col-span-4 fc-columns__stack">
        <RecordCard title={AdminI18n.t('users.summary')}>
          <div className="fc-stack">
            <AdminFactGrid facts={[
              { key: 'type', label: AdminI18n.t('users.roleType'), value: type },
              { key: 'scope', label: AdminI18n.t('users.selectedScope'), value: permissionCount === 0 ? AdminI18n.t('users.noPermissions') : AdminI18n.t('users.actionsSelected', { permissionCount }) },
            ]} />
            {onCancel ? (
              <div className="fc-record-card__table-tools">
                <Button variant={ButtonVariant.SECONDARY} onClick={onCancel}>{AdminI18n.t('users.cancel')}</Button>
                {this.readOnly ? null : <Button type="submit" variant={ButtonVariant.PRIMARY} isLoading={loading}>{this.saveLabel ?? AdminI18n.t('users.save')}</Button>}
              </div>
            ) : null}
            <InlineTip label={this.tipLabel ?? AdminI18n.t('users.securityNote')}>{this.tip ?? AdminI18n.t('users.changesToRolePermissionsAre')}</InlineTip>
          </div>
        </RecordCard>
      </div>
    );
  }
}

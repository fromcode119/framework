import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { RecordCard } from '@/components/ui/view/record-card.client';
import { Alert } from '@/components/ui/view/alert.client';
import { Text } from '@/components/ui/view/text.client';
import { Button } from '@/components/ui/view/button.client';
import { RolePermissionGroup } from '@/app/users/roles/components/view/role-permission-group.client';
import { RolePermissionSelection } from '@/app/users/roles/services/role-permission-selection';
import type { IPermissionCatalogGroup } from '@/app/users/roles/interfaces/permission-catalog-group.interface';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { AdminRichText } from '@/components/ui/view/admin-rich-text.client';

/**
 * The permission picker the create and edit role screens share: the framework's permissions, then
 * each plugin this site runs with its screens and a Read / Create / Update / Delete grid over its
 * collections. What a user with the role sees in the console follows from exactly these ticks.
 */
export class RolePermissionsEditor extends PureReactor {
  declare props: Pick<RolePermissionsEditor, 'groups' | 'selected' | 'onChange' | 'loadError' | 'readOnly'>;

  @prop declare groups: IPermissionCatalogGroup[];
  @prop declare selected: string[];
  @prop declare onChange: (next: string[]) => void;
  /** Set when the catalog could not be loaded — never shown as "nothing to choose from". */
  @prop declare loadError?: string;
  /** Shows the role's permissions without letting them change — a platform role viewed from a site. */
  @prop declare readOnly?: boolean;

  private renderUnrecognised(): ReactNode {
    const unknown = RolePermissionSelection.unrecognised(this.selected, this.groups);
    if (unknown.length === 0) return null;
    return (
      <Alert tone="warning" action={<Button type="button" variant={ButtonVariant.SECONDARY} onClick={() => this.onChange(this.selected.filter((name) => !unknown.includes(name)))}>{AdminI18n.t('users.remove')}</Button>}>
        <AdminRichText k={unknown.length === 1 ? 'users.unknownPermissionOne' : 'users.unknownPermissionMany'} vars={{ names: unknown.map((name) => `<code>${name}</code>`).join(', ') }} />
      </Alert>
    );
  }

  render(): ReactNode {
    const { groups, selected, loadError } = this;
    const everything = selected.includes('*');
    return (
      // The explanation in a card of its own, then one list card an area — never a card of cards.
      <div className="fc-columns__stack">
        <RecordCard title={AdminI18n.t('users.permissions')}>
          <div className="fc-stack">
            <Text muted><AdminRichText k="users.permissionsExplained" /></Text>
            {loadError ? <Alert tone="danger">{loadError}</Alert> : null}
            {everything ? <Alert tone="info"><AdminRichText k="users.roleHoldsEverything" /></Alert> : null}
            {this.renderUnrecognised()}
          </div>
        </RecordCard>
        {groups.map((group) => (
          <RolePermissionGroup key={group.key} group={group} selected={selected} onChange={this.onChange} readOnly={this.readOnly} />
        ))}
      </div>
    );
  }
}

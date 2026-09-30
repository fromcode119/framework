import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { Card } from '@/components/ui/view/card.client';
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
      <div className="fc-scope-notice">
        <span className="fc-scope-notice__text">
          <AdminRichText k={unknown.length === 1 ? 'users.unknownPermissionOne' : 'users.unknownPermissionMany'} vars={{ names: unknown.map((name) => `<code>${name}</code>`).join(', ') }} />
        </span>
        <Button
          type="button"
          onClick={() => this.onChange(this.selected.filter((name) => !unknown.includes(name)))}
          className="h-8 px-3 rounded-lg text-[11px] font-bold uppercase tracking-tight flex-shrink-0"
        >
          {AdminI18n.t('users.remove')}
        </Button>
      </div>
    );
  }

  render(): ReactNode {
    const { groups, selected, loadError } = this;
    const everything = selected.includes('*');
    return (
      <Card title={AdminI18n.t('users.permissions')}>
        <div className="flex flex-col gap-3">
          <p className="text-[11px] text-slate-500">
            <AdminRichText k="users.permissionsExplained" />
          </p>
          {loadError ? <div className="fc-scope-notice"><span className="fc-scope-notice__text">{loadError}</span></div> : null}
          {everything ? (
            <div className="fc-scope-notice">
              <span className="fc-scope-notice__text"><AdminRichText k="users.roleHoldsEverything" /></span>
            </div>
          ) : null}
          {this.renderUnrecognised()}
          {groups.map((group) => (
            <RolePermissionGroup key={group.key} group={group} selected={selected} onChange={this.onChange} readOnly={this.readOnly} />
          ))}
        </div>
      </Card>
    );
  }
}

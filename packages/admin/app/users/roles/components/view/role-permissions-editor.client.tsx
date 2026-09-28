import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { Card } from '@/components/ui/view/card.client';
import { Button } from '@/components/ui/view/button.client';
import { RolePermissionGroup } from '@/app/users/roles/components/view/role-permission-group.client';
import { RolePermissionSelection } from '@/app/users/roles/services/role-permission-selection';
import type { IPermissionCatalogGroup } from '@/app/users/roles/interfaces/permission-catalog-group.interface';

/**
 * The permission picker the create and edit role screens share: the framework's permissions, then
 * each plugin this site runs with its screens and a Read / Create / Update / Delete grid over its
 * collections. What a user with the role sees in the console follows from exactly these ticks.
 */
export class RolePermissionsEditor extends PureReactor {
  declare props: Pick<RolePermissionsEditor, 'groups' | 'selected' | 'onChange' | 'loadError'>;

  @prop declare groups: IPermissionCatalogGroup[];
  @prop declare selected: string[];
  @prop declare onChange: (next: string[]) => void;
  /** Set when the catalog could not be loaded — never shown as "nothing to choose from". */
  @prop declare loadError?: string;

  private renderUnrecognised(): ReactNode {
    const unknown = RolePermissionSelection.unrecognised(this.selected, this.groups);
    if (unknown.length === 0) return null;
    return (
      <div className="fc-scope-notice">
        <span className="fc-scope-notice__text">
          This role also lists {unknown.map((name, index) => <span key={name}>{index > 0 ? ', ' : ''}<code>{name}</code></span>)}.
          Nothing on this site checks {unknown.length === 1 ? 'it' : 'them'}, so {unknown.length === 1 ? 'it grants' : 'they grant'} nothing here.
        </span>
        <Button
          type="button"
          onClick={() => this.onChange(this.selected.filter((name) => !unknown.includes(name)))}
          className="h-8 px-3 rounded-lg text-[11px] font-bold uppercase tracking-tight flex-shrink-0"
        >
          Remove
        </Button>
      </div>
    );
  }

  render(): ReactNode {
    const { groups, selected, loadError } = this;
    const everything = selected.includes('*');
    return (
      <Card title="Permissions">
        <div className="flex flex-col gap-3">
          <p className="text-[11px] text-slate-500">
            A user sees a screen in the console only when their role opens it. A collection&apos;s list needs <strong>Read</strong>;
            adding, editing and removing its records need <strong>Create</strong>, <strong>Update</strong> and <strong>Delete</strong>.
          </p>
          {loadError ? <div className="fc-scope-notice"><span className="fc-scope-notice__text">{loadError}</span></div> : null}
          {everything ? (
            <div className="fc-scope-notice">
              <span className="fc-scope-notice__text">This role holds <strong>Everything</strong>, so every permission below is already included.</span>
            </div>
          ) : null}
          {this.renderUnrecognised()}
          {groups.map((group) => (
            <RolePermissionGroup key={group.key} group={group} selected={selected} onChange={this.onChange} />
          ))}
        </div>
      </Card>
    );
  }
}

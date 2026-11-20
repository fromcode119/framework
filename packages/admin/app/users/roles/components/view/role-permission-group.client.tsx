import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { Checkbox } from '@/components/ui/view/checkbox.client';
import { ListShell } from '@/components/ui/view/list-shell.client';
import { ListRow } from '@/components/ui/view/list-row.client';
import { DataTable } from '@/components/ui/view/data-table.client';
import { Text } from '@/components/ui/view/text.client';
import { RolePermissionSelection } from '@/app/users/roles/services/role-permission-selection';
import type { IPermissionCatalogGroup } from '@/app/users/roles/interfaces/permission-catalog-group.interface';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * One area of the role editor — the framework, or one plugin: its named permissions, then a
 * Read / Create / Update / Delete grid over its collections. Collapsed unless the role holds something
 * in it, so a role for one plugin does not scroll past every other plugin's grid.
 */
export class RolePermissionGroup extends PureReactor {
  declare props: Pick<RolePermissionGroup, 'group' | 'selected' | 'onChange' | 'readOnly'>;

  @prop declare group: IPermissionCatalogGroup;
  @prop declare selected: string[];
  @prop declare onChange: (next: string[]) => void;
  /** Show what the role holds without offering to change it. */
  @prop declare readOnly?: boolean;

  private change(next: string[]): void {
    if (!this.readOnly) this.onChange(next);
  }

  private box(name: string): ReactNode {
    const included = RolePermissionSelection.isIncluded(this.selected, name) && !this.selected.includes(name);
    return (
      <span title={included ? AdminI18n.t('users.includedByABroaderPermission') : name}>
        <Checkbox
          checked={RolePermissionSelection.isOn(this.selected, name)}
          disabled={this.readOnly || included}
          onChange={() => this.change(RolePermissionSelection.toggle(this.selected, name))}
        />
      </span>
    );
  }

  private renderAll(): ReactNode {
    const { group } = this;
    if (!group.all) return null;
    return <ListRow title={AdminI18n.t('users.everythingIn', { group: group.label })} description={AdminI18n.t('users.everythingInHint', { group: group.label })} actions={this.box(group.all)} />;
  }

  private renderPermissions(): ReactNode {
    return this.group.permissions.map((permission) => (
      <ListRow key={permission.name} title={permission.label} description={permission.description} descriptionTitle={permission.description} meta={permission.name} actions={this.box(permission.name)} />
    ));
  }

  /** Read / Create / Update / Delete over the area's collections; the first box of a row ticks all of them. */
  private renderCollections(): ReactNode {
    const { collections } = this.group;
    if (collections.length === 0) return null;
    return (
      <DataTable
        cards={false}
        columns={[
          { header: AdminI18n.t('users.collection'), id: 'collection', className: 'fc-dt-fill', accessor: (collection: any) => {
            const names = Object.values(collection.actions) as string[];
            const onCount = names.filter((name) => RolePermissionSelection.isOn(this.selected, name)).length;
            return (
              <Checkbox
                checked={onCount === names.length}
                indeterminate={onCount > 0 && onCount < names.length}
                disabled={this.readOnly}
                onChange={(on: boolean) => this.change(RolePermissionSelection.setAll(this.selected, names, on))}
                label={<span className="fc-dt-strong">{collection.label}</span>}
              />
            );
          } },
          ...RolePermissionSelection.ACTIONS.map((action) => ({
            header: action, id: action,
            accessor: (collection: any) => (collection.actions[action]
              ? this.box(collection.actions[action])
              : <span className="fc-dt-quiet" title={AdminI18n.t('users.doesNotAllow', { label: collection.label, action })}>—</span>),
          })),
        ] as any}
        data={collections.map((collection) => ({ ...collection, id: collection.key }))}
      />
    );
  }

  render(): ReactNode {
    const { group } = this;
    const count = RolePermissionSelection.countIn(this.selected, group);
    const total = RolePermissionSelection.namesOf(group).length;
    return (
      // Always open: a group that folds hides the permissions a role holds behind a click, and a role is
      // read by reading all of them. The head is a heading, not a control.
      <ListShell title={group.label} actions={<Text size="xsmall" muted as="span">{AdminI18n.t('users.countOfTotal', { count, total })}</Text>}>
        <div>
          {this.renderAll()}
          {this.renderPermissions()}
        </div>
        {this.renderCollections()}
      </ListShell>
    );
  }
}

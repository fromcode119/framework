import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { PermissionGrants } from '@fromcode119/core/utils/permission-grants';
import { ListShell } from '@/components/ui/view/list-shell.client';
import { DataTable } from '@/components/ui/view/data-table.client';
import { Badge } from '@/components/ui/view/badge.client';
import { RolePermissionSelection } from '@/app/users/roles/services/role-permission-selection';
import type { IPermissionCatalogGroup } from '@/app/users/roles/interfaces/permission-catalog-group.interface';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * One area of the permission list — the framework or one plugin — and, for each permission in it,
 * the roles that grant it. Roles holding Everything are left out of each line; the page names them once.
 */
export class PermissionCatalogGroupCard extends PureReactor {
  declare props: Pick<PermissionCatalogGroupCard, 'group' | 'roles'>;

  @prop declare group: IPermissionCatalogGroup;
  /** Roles other than the all-powerful ones, each with the permissions it lists. */
  @prop declare roles: Array<{ slug: string; name: string; permissions: string[] }>;

  private grantedBy(name: string): ReactNode {
    const holders = this.roles.filter((role) => PermissionGrants.covers(role.permissions, name));
    if (holders.length === 0) return <span className="fc-dt-quiet">{AdminI18n.t('users.noRole')}</span>;
    return <span className="fc-chip-row fc-chip-row--cell">{holders.map((role) => <Badge key={role.slug}>{role.name}</Badge>)}</span>;
  }

  render(): ReactNode {
    const { group } = this;
    const named = [
      ...(group.all ? [{ name: group.all, label: AdminI18n.t('users.everythingIn', { label: group.label }), description: AdminI18n.t('users.everyScreenActionAndCollection') }] : []),
      ...group.permissions,
    ];
    // The area's permissions, then — in the same card, under them — what each of its collections lets a
    // role do. Two tables of one thing, so one card.
    return (
      <ListShell title={group.label} count={named.length}>
        <DataTable
          cards={false}
          columns={[
            { header: AdminI18n.t('users.permission'), id: 'permission', className: 'fc-dt-fill fc-dt-wrap', accessor: (permission: any) => (
              <span className="fc-dt-lines">
                <span className="fc-dt-strong">{permission.label}</span>
                <span className="fc-dt-quiet">{permission.description}</span>
                <code className="fc-dt-code">{permission.name}</code>
              </span>
            ) },
            { header: AdminI18n.t('users.grantedBy'), id: 'grantedBy', className: 'fc-dt-wrap', accessor: (permission: any) => this.grantedBy(permission.name) },
          ] as any}
          data={named.map((permission) => ({ ...permission, id: permission.name }))}
        />
        {group.collections.length > 0 ? (
          <DataTable
            cards={false}
            columns={[
              { header: AdminI18n.t('users.collection'), id: 'collection', accessor: (collection: any) => <span className="fc-dt-strong">{collection.label}</span> },
              ...RolePermissionSelection.ACTIONS.map((action) => ({
                header: action, id: action, className: 'fc-dt-wrap',
                accessor: (collection: any) => (collection.actions[action] ? this.grantedBy(collection.actions[action]) : '—'),
              })),
            ] as any}
            data={group.collections.map((collection) => ({ ...collection, id: collection.key }))}
          />
        ) : null}
      </ListShell>
    );
  }
}

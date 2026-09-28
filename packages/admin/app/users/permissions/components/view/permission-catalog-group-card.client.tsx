import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { PermissionGrants } from '@fromcode119/core/utils/permission-grants';
import { Card } from '@/components/ui/view/card.client';
import { RolePermissionSelection } from '@/app/users/roles/services/role-permission-selection';
import type { IPermissionCatalogGroup } from '@/app/users/roles/interfaces/permission-catalog-group.interface';

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
    if (holders.length === 0) return <span className="text-[11px] text-slate-400">No role</span>;
    return (
      <span className="flex flex-wrap gap-1">
        {holders.map((role) => (
          <span key={role.slug} className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{role.name}</span>
        ))}
      </span>
    );
  }

  render(): ReactNode {
    const { group } = this;
    const named = [
      ...(group.all ? [{ name: group.all, label: `Everything in ${group.label}`, description: 'Every screen, action and collection of this area.' }] : []),
      ...group.permissions,
    ];
    return (
      <Card title={group.label}>
        <div className="flex flex-col gap-4">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[10px] font-semibold uppercase tracking-tight text-slate-400">
                  <th className="py-2 pr-4 text-left">Permission</th>
                  <th className="py-2 text-left">Granted by</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {named.map((permission) => (
                  <tr key={permission.name}>
                    <td className="py-2.5 pr-4 align-top">
                      <span className="flex flex-col gap-0.5">
                        <span className="font-semibold text-slate-800 dark:text-slate-100">{permission.label}</span>
                        <span className="text-[11px] text-slate-500">{permission.description}</span>
                        <code className="text-[10px] text-slate-400">{permission.name}</code>
                      </span>
                    </td>
                    <td className="py-2.5 align-top">{this.grantedBy(permission.name)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {group.collections.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 text-[10px] font-semibold uppercase tracking-tight text-slate-400 dark:bg-slate-900/60">
                    <th className="px-3 py-2 text-left">Collection</th>
                    {RolePermissionSelection.ACTIONS.map((action) => <th key={action} className="px-3 py-2 text-left">{action}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {group.collections.map((collection) => (
                    <tr key={collection.key}>
                      <td className="px-3 py-2 align-top font-semibold text-slate-700 dark:text-slate-200">{collection.label}</td>
                      {RolePermissionSelection.ACTIONS.map((action) => (
                        <td key={action} className="px-3 py-2 align-top">
                          {collection.actions[action] ? this.grantedBy(collection.actions[action]) : <span className="text-slate-300">—</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </Card>
    );
  }
}

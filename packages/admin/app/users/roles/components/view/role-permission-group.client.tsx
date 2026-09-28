import type { ReactNode } from 'react';
import { PureReactor, prop, state, bound } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { Checkbox } from '@/components/ui/view/checkbox.client';
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

  @state private open: boolean | null = null;

  private get expanded(): boolean {
    return this.open ?? RolePermissionSelection.countIn(this.selected, this.group) > 0;
  }

  @bound private toggleOpen(): void {
    this.open = !this.expanded;
  }

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
    return (
      <label className="flex items-start gap-3 rounded-lg border border-indigo-100 bg-indigo-50/60 px-3 py-2.5 dark:border-indigo-500/20 dark:bg-indigo-500/5">
        {this.box(group.all)}
        <span className="flex flex-col gap-0.5">
          <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">{AdminI18n.t('users.everythingIn', { group: group.label })}</span>
          <span className="text-[11px] text-slate-500">{AdminI18n.t('users.everythingInHint', { group: group.label })}</span>
        </span>
      </label>
    );
  }

  private renderPermissions(): ReactNode {
    if (this.group.permissions.length === 0) return null;
    return (
      <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
        {this.group.permissions.map((permission) => (
          <label key={permission.name} className="flex items-start gap-3 py-2.5">
            {this.box(permission.name)}
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">{permission.label}</span>
              <span className="text-[11px] text-slate-500">{permission.description}</span>
              <code className="text-[10px] text-slate-400">{permission.name}</code>
            </span>
          </label>
        ))}
      </div>
    );
  }

  private renderCollections(): ReactNode {
    const { collections } = this.group;
    if (collections.length === 0) return null;
    return (
      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 text-[10px] font-semibold uppercase tracking-tight text-slate-400 dark:bg-slate-900/60">
              <th className="px-3 py-2 text-left">{AdminI18n.t('users.collection')}</th>
              {RolePermissionSelection.ACTIONS.map((action) => (
                <th key={action} className="w-16 px-2 py-2 text-center">{action}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {collections.map((collection) => {
              const names = Object.values(collection.actions);
              const onCount = names.filter((name) => RolePermissionSelection.isOn(this.selected, name)).length;
              return (
                <tr key={collection.key}>
                  <td className="px-3 py-2">
                    <span className="flex items-center gap-2">
                      <Checkbox
                        checked={onCount === names.length}
                        indeterminate={onCount > 0 && onCount < names.length}
                        disabled={this.readOnly}
                        onChange={(on: boolean) => this.change(RolePermissionSelection.setAll(this.selected, names, on))}
                      />
                      <span className="font-semibold text-slate-700 dark:text-slate-200">{collection.label}</span>
                    </span>
                  </td>
                  {RolePermissionSelection.ACTIONS.map((action) => (
                    <td key={action} className="px-2 py-2">
                      <span className="flex justify-center">
                        {collection.actions[action] ? this.box(collection.actions[action]) : <span className="text-slate-300" title={AdminI18n.t('users.doesNotAllow', { label: collection.label, action: action })}>—</span>}
                      </span>
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  render(): ReactNode {
    const { group } = this;
    const count = RolePermissionSelection.countIn(this.selected, group);
    const total = RolePermissionSelection.namesOf(group).length;
    return (
      <section className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/50">
        <button type="button" onClick={this.toggleOpen} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
          <span className="flex items-center gap-2">
            {this.expanded ? <FrameworkIcons.ChevronDown size={14} className="text-slate-400" /> : <FrameworkIcons.ChevronRight size={14} className="text-slate-400" />}
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{group.label}</span>
          </span>
          <span className={`text-[10px] font-bold uppercase tracking-tight ${count > 0 ? 'text-indigo-500' : 'text-slate-400'}`}>
            {count} of {total}
          </span>
        </button>
        {this.expanded ? (
          <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 dark:border-slate-800">
            {this.renderAll()}
            {this.renderPermissions()}
            {this.renderCollections()}
          </div>
        ) : null}
      </section>
    );
  }
}

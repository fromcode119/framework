import { PermissionGrants } from '@fromcode119/core/utils/permission-grants';
import type { IPermissionCatalogGroup } from '@/app/users/roles/interfaces/permission-catalog-group.interface';

/**
 * What a role's permission list looks like in the editor. Pure: the component asks, this answers.
 *
 * A permission is TICKED when the role lists it, and INCLUDED when a wildcard the role lists covers it
 * (`ecommerce:*` covers `ecommerce:orders:read`). An included box is shown ticked and cannot be
 * unticked on its own — unticking it would change nothing, because the wildcard still grants it.
 */
export class RolePermissionSelection {
  /** The operations in the order the collection table shows them. */
  static readonly ACTIONS = ['read', 'create', 'update', 'delete'] as const;

  static toggle(selected: string[], name: string): string[] {
    return selected.includes(name) ? selected.filter((entry) => entry !== name) : [...selected, name];
  }

  /** Tick or untick several at once (a collection's whole row). */
  static setAll(selected: string[], names: string[], on: boolean): string[] {
    const rest = selected.filter((entry) => !names.includes(entry));
    return on ? [...rest, ...names] : rest;
  }

  /** Granted by a wildcard the role lists, other than the permission itself. */
  static isIncluded(selected: string[], name: string): boolean {
    const others = selected.filter((entry) => entry !== name);
    return PermissionGrants.covers(others, name);
  }

  static isOn(selected: string[], name: string): boolean {
    return selected.includes(name) || RolePermissionSelection.isIncluded(selected, name);
  }

  /** Every name a group offers. */
  static namesOf(group: IPermissionCatalogGroup): string[] {
    return [
      ...(group.all ? [group.all] : []),
      ...group.permissions.map((permission) => permission.name),
      ...group.collections.flatMap((collection) => Object.values(collection.actions)),
    ];
  }

  /** How many of a group's permissions the role holds, counting ones a wildcard includes. */
  static countIn(selected: string[], group: IPermissionCatalogGroup): number {
    return RolePermissionSelection.namesOf(group).filter((name) => RolePermissionSelection.isOn(selected, name)).length;
  }

  /** Names the role lists that no group on this site offers — nothing here checks them. */
  static unrecognised(selected: string[], groups: IPermissionCatalogGroup[]): string[] {
    const offered = new Set(groups.flatMap((group) => RolePermissionSelection.namesOf(group)));
    return selected.filter((name) => !offered.has(name));
  }
}

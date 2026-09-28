import {
  PluginManager,
  PluginState,
  PluginTenantAccess,
  RequestContextUtils,
  TenantMode,
  FrameworkPermissions,
  PermissionNames,
  CollectionPermissionAction,
  CollectionLabelUtils,
} from '@fromcode119/core';
import type { ICollection, IPermissionDefinition } from '@fromcode119/core';
import type { IPermissionCatalogGroup } from '@api/services/interfaces/permission-catalog-group.interface';
import type { IPermissionCatalogCollection } from '@api/services/interfaces/permission-catalog-collection.interface';

/**
 * Every permission a role can be given here, grouped the way the role editor shows them.
 *
 * DERIVED, not stored. It used to be a registry table filled from each plugin's manifest
 * `capabilities` — what a plugin's CODE may do inside its sandbox (`database:raw`, `network`) — which
 * no role check ever asks about. A role given one of those gained nothing, and the permissions the
 * gates do ask for were missing from the list. Now each entry is a name some gate checks:
 *
 * - the framework's own ({@link FrameworkPermissions}),
 * - per plugin: `<plugin>:*`, `<plugin>:manage` (its own screens and API routes — what the plugin
 *   route gate derives for an undeclared route), any permission its menu declares, and
 *   `<plugin>:<collection>:<action>` for each collection and each operation that collection allows.
 *
 * Scoped to the plugins this site runs, so a site is never shown another product's vocabulary.
 */
export class PermissionCatalogService {
  constructor(private readonly manager: PluginManager) {}

  list(): IPermissionCatalogGroup[] {
    const framework: IPermissionCatalogGroup = {
      key: 'framework',
      label: 'Framework',
      permissions: FrameworkPermissions.DEFINITIONS.map((definition) => ({ ...definition })),
      collections: [],
    };
    const plugins = this.visiblePlugins()
      .map((plugin) => this.pluginGroup(plugin))
      .sort((a, b) => a.label.localeCompare(b.label));
    return [framework, ...plugins];
  }

  /** Every permission name the catalog offers, flattened — what a role may be saved with. */
  names(): Set<string> {
    const names = new Set<string>();
    for (const group of this.list()) {
      if (group.all) names.add(group.all);
      group.permissions.forEach((permission) => names.add(permission.name));
      group.collections.forEach((collection) => Object.values(collection.actions).forEach((name) => names.add(name)));
    }
    return names;
  }

  private visiblePlugins(): any[] {
    const active = this.manager.getPlugins().filter((plugin: any) => plugin.state === PluginState.ACTIVE);
    const tenantId = String(RequestContextUtils.getTenantId() ?? '').trim();
    if (!TenantMode.isEnabled() || !tenantId) return active;
    const enabled = PluginTenantAccess.enabledSlugsFor(tenantId);
    return active.filter((plugin: any) => enabled.has(String(plugin.manifest?.slug ?? '')));
  }

  private pluginGroup(plugin: any): IPermissionCatalogGroup {
    const manifest = plugin.manifest ?? {};
    const slug = String(manifest.slug ?? '').trim().toLowerCase();
    const label = String(manifest.admin?.label || manifest.name || slug).trim();
    return {
      key: slug,
      label,
      all: PermissionNames.pluginAll(slug),
      permissions: this.screenPermissions(slug, label, manifest.admin?.menu ?? []),
      collections: this.collectionsOf(slug),
    };
  }

  /**
   * `<plugin>:manage`, plus each permission the plugin's menu asks for, named after the screens it opens.
   * A menu item that declares `permission` is shown only to a role that holds it — that is how a plugin
   * gives an employee one screen of their own without the management screens beside it.
   */
  private screenPermissions(slug: string, pluginLabel: string, menu: any[]): IPermissionDefinition[] {
    const manage = PermissionNames.pluginManage(slug);
    const screens = new Map<string, string[]>();
    const walk = (items: any[]): void => {
      for (const item of items) {
        if (Array.isArray(item?.children)) walk(item.children);
        const name = String(item?.permission ?? '').trim();
        if (!name) continue;
        screens.set(name, [...(screens.get(name) ?? []), String(item.label ?? item.path ?? '').trim()].filter(Boolean));
      }
    };
    walk(Array.isArray(menu) ? menu : []);

    const manageScreens = screens.get(manage) ?? [];
    const definitions: IPermissionDefinition[] = [{
      name: manage,
      label: `${pluginLabel} screens and actions`,
      description: manageScreens.length > 0
        ? `Open ${manageScreens.join(', ')}, and use the actions on ${pluginLabel}'s own screens.`
        : `Open ${pluginLabel}'s own screens and use their actions (everything that is not a collection list).`,
    }];
    for (const [name, labels] of screens) {
      if (name === manage) continue;
      definitions.push({ name, label: labels.join(', '), description: `Open ${labels.join(', ')}.` });
    }
    return definitions;
  }

  private collectionsOf(slug: string): IPermissionCatalogCollection[] {
    const collections = (this.manager.getCollections() as ICollection[])
      .filter((collection) => String(collection.pluginSlug ?? '').trim().toLowerCase() === slug && !collection.system);
    return collections
      .map((collection) => {
        const key = PermissionNames.collectionKey(collection);
        const actions: Record<string, string> = {};
        for (const action of CollectionPermissionAction.all()) {
          // An operation the collection turns off (`api: { delete: false }`) does not exist for anyone,
          // so there is nothing to grant.
          if ((collection.api as Record<string, boolean> | undefined)?.[action.value] === false) continue;
          actions[action.value] = PermissionNames.collection(slug, key, action);
        }
        return { key, label: CollectionLabelUtils.labelFor(collection, key), actions };
      })
      .filter((collection) => Object.keys(collection.actions).length > 0)
      .sort((a, b) => a.label.localeCompare(b.label));
  }
}

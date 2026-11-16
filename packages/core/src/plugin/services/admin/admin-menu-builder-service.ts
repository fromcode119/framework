import { StringUtils } from '@core/utils/string-utils';
import { AdminMenuAreaService } from '@core/plugin/services/admin/admin-menu-area-service';
import type { ILoadedPlugin } from '@core/interfaces/loaded-plugin.interface';
import type { ICollection } from '@core/collections/interfaces/collection.interface';
import { CollectionLabelUtils } from '@core/collections/collection-label-utils';
import { Logger } from '@core/logging';
import { CoreServices } from '@core/services';
import { AdminRouteUtils } from '@core/plugin/services/admin/admin-route-utils';
import { AdminSystemNavigationMetadataService } from '@core/plugin/services/admin/admin-system-navigation-metadata-service';
import { PermissionNames } from '@core/utils/permission-names';
import { CollectionPermissionAction } from '@core/enums/collection-permission-action.enum';

/**
 * AdminMenuBuilderService
 *
 * Builds the admin navigation menu from system nav items plus each active
 * plugin's manifest menu / collections, bucketing by plugin+group and resolving
 * dropdown-vs-section strategy. Extracted from AdminMetadataService to keep that
 * class under the size limit; behavior is identical and the metadata service
 * delegates menu construction here.
 */
export class AdminMenuBuilderService {
  constructor(
    private logger: Logger,
    private systemNavigationMetadata: AdminSystemNavigationMetadataService,
  ) {}

  public build(
    allPlugins: ILoadedPlugin[],
    pluginMetadata: any[],
    registeredCollections: Map<string, { collection: ICollection; pluginSlug: string }>,
  ): any[] {
    const rawMenuItems: any[] = this.systemNavigationMetadata
      .getMenuItems()
      .map((item) => ({
        ...item,
        pluginSlug: 'system',
      }));

    // Plugin Items
    pluginMetadata.forEach(p => {
      const slug = p.slug.toLowerCase();
      const pluginCollections = Array.from(registeredCollections.values())
        .filter(c => String(c.pluginSlug).toLowerCase() === slug)
        .map(c => c.collection);
      const collectionRouteKeys = AdminRouteUtils.buildCollectionRouteKeySet([
        ...(p.admin?.collections || []),
        ...pluginCollections
      ]);
      const declaredSlots = new Set<string>(
        ((p.admin?.slots || []) as Array<{ slot?: string }>)
          .map((slotDef) => String(slotDef?.slot || '').trim())
          .filter(Boolean)
      );
      const secondaryPanelPaths = new Set<string>(
        ((p.admin?.secondaryPanel?.items || []) as Array<{ path?: string }>)
          .map((item) => String(item?.path || '').trim().toLowerCase())
          .filter(Boolean)
      );
      const contentSlot = `admin.plugin.${slug}.content`;

      if (p.admin?.menu) {
        p.admin.menu.forEach((item: any) => {
          let effectivePath = item.path;

          // These are LOGICAL menu paths (resolved to the real admin URL later via toAdminPath) — they
          // never carry an admin base, and the admin may live at the root, a sub-path, or a separate
          // domain, so we must NOT sniff for any hardcoded `/admin/` prefix here. Only rewrite a bare
          // single-segment collection slug (`/widgets` → `/<plugin>/widgets`); the plugin root
          // (`/${slug}`) and already-scoped paths (`/${slug}/...`) are left as-is. The hasMatchingCollection
          // guard below is what actually constrains the rewrite — a multi-segment path can't match a
          // collection slug, so it is never rewritten regardless of what its first segment is.
          if (effectivePath && effectivePath !== `/${slug}` && !effectivePath.startsWith(`/${slug}/`)) {
            const pathSlug = effectivePath.replace(/^\//, '');
            const registeredForPlugin = pluginCollections;

            const hasMatchingCollection =
              p.admin.collections?.some((col: any) => col.shortSlug === pathSlug || col.slug === pathSlug || (col as any).unprefixedSlug === pathSlug) ||
              registeredForPlugin.some(col => col.shortSlug === pathSlug || col.slug === pathSlug || (col as any).unprefixedSlug === pathSlug);

            if (hasMatchingCollection) {
                effectivePath = `/${slug}/${pathSlug}`;
            }
          }

          // Validate plugin page routes early so broken paths never reach runtime.
          if (effectivePath && effectivePath.startsWith(`/${slug}`) && !AdminRouteUtils.isCollectionMenuPath(effectivePath, slug, collectionRouteKeys)) {
            const expectedSlot = AdminRouteUtils.expectedPageSlotFromPath(effectivePath, slug);
            const hasExpectedSlot = expectedSlot ? declaredSlots.has(expectedSlot) : false;
            const hasContentFallback = declaredSlots.has(contentSlot);
            if (!hasExpectedSlot && !hasContentFallback) {
              this.logger.warn(
                `[admin-metadata] Skipping menu item "${item.label}" for plugin "${slug}" at "${effectivePath}" because no UI slot is declared. Expected "${expectedSlot}", or fallback "${contentSlot}".`
              );
              return;
            }
          }

          rawMenuItems.push({
            ...this.withPermission(item, slug, pluginCollections),
            path: effectivePath,
            pluginSlug: slug,
            group: item.group || p.admin.group || p.name,
            blockKey: AdminMenuAreaService.blockKeyOf(p)
          });
        });
      }

      const collections = pluginCollections;

      if (collections.length > 0) {
        collections.forEach(col => {
          if (col.admin?.hidden) return;
          if (col.slug === 'settings') return;

          const shortSlug = (col.shortSlug || col.slug).toLowerCase();

          let path = `/${slug}/${shortSlug}`;

          // Shorter URL for primary collections (e.g. /forms instead of /forms/forms)
          if (shortSlug === slug) {
              path = `/${slug}`;
          }

          if (secondaryPanelPaths.has(path.toLowerCase())) {
            return;
          }

          const label = CollectionLabelUtils.labelFor(col, shortSlug);

          const isExplicitlyHandled = rawMenuItems.some(m => {
             if (m.pluginSlug !== slug) return false;
             const candidatePaths = CoreServices.getInstance().menu.getNestedPaths(m);
             return candidatePaths.some((candidatePath: any) => {
               if (candidatePath === path) return true;
               const normalizedPath = candidatePath?.toLowerCase().replace(/^\/[^/]+\//, '').replace(/^\//, '');
               if (normalizedPath === shortSlug) return true;
               // Also check the root path if it's a primary collection
               if (shortSlug === slug && candidatePath === `/${slug}`) return true;
               return false;
             });
          });

          if (!isExplicitlyHandled) {
            const isDuplicate = rawMenuItems.some(m =>
              m.path === path ||
              (m.label.toLowerCase() === label.toLowerCase() && m.pluginSlug === slug)
            );

            if (!isDuplicate) {
              rawMenuItems.push({
                label,
                path,
                icon: col.admin?.icon || p.admin.icon || 'FileText',
                // The AREA is the plugin's, not the table's: a collection naming its own group put one
                // plugin's pages in two places in the menu, which is what made a plugin unfindable.
                group: p.admin.group || p.name,
                priority: col.admin?.priority || col.priority || 100,
                pluginSlug: slug,
                // The collection's own key, as its dictionary spells it: the path is lower-cased, so
                // `admin.collections.deliverySlots.label` could not be found from `/shop/deliveryslots`.
                collectionKey: String(col.shortSlug || col.slug),
                // The BLOCK this page reads under: a courier's cities belong inside delivery, not
                // beside it. A table is its plugin's, so it joins whatever block the plugin named.
                blockKey: AdminMenuAreaService.blockKeyOf(p),
                // The permission that opens this screen is reading its collection — the same name the
                // collections API checks, so the menu never offers a list the API then refuses.
                permission: PermissionNames.collection(slug, PermissionNames.collectionKey(col), CollectionPermissionAction.READ),
                // DERIVED, not declared. A plugin's tables are tenant-isolated by
                // `TenantScopedTables`, so with no site selected every one of these screens would
                // answer zero rows — a list that renders empty and explains nothing. No manifest flag
                // to forget: it follows from where the data lives.
                siteOnly: true,
              });
            }
          }
        });
      }
    });

    const finalMenu: any[] = [];

    /**
     * The console's own entries (Dashboard, Media, Settings…) are its fixed core and stand as they are.
     * Everything a PLUGIN contributes is filed under the AREA it declares (`admin.group`) — one entry
     * per area, holding the pages of every plugin that named it.
     *
     * It used to bucket by plugin AND group, so the area was declared and then thrown away: a delivery
     * plugin and a carrier adapter for it both name the same area, and each still got a top-level row
     * of its own — as did every payment adapter beside the plugin it extends. The menu followed the
     * plugins rather than the work, which is what makes a console with dozens of them unusable.
     * The consoles this one is measured against do the same thing the other way round — a fixed core, and
     * an extension that names a core route is drawn inside it rather than beside it.
     *
     * The area is a shared key, not a name one plugin takes from another: `commerce` is translated by
     * each plugin's own `admin.groups.commerce`, exactly as the related-records parts work.
     */
    const systemItems: any[] = [];
    const areaBuckets: Record<string, { key: string; groupName: string; items: any[] }> = {};

    rawMenuItems.forEach(item => {
      if (String(item.pluginSlug || '') === 'system') {
        systemItems.push(item);
        return;
      }
      const groupName = String(item.group || 'Platform');
      const key = StringUtils.slugify(groupName, '');
      if (!areaBuckets[key]) areaBuckets[key] = { key, groupName, items: [] };
      areaBuckets[key].items.push(item);
    });

    systemItems.forEach(item => finalMenu.push(item));

    Object.values(areaBuckets).forEach(bucket => {
      const items = AdminMenuAreaService.order(bucket.items, allPlugins);
      // An area holding one page is that page: a row with a chevron that opens a list of one says nothing.
      if (items.length === 1) {
        finalMenu.push({ ...items[0], group: bucket.groupName, groupKey: bucket.key });
        return;
      }
      const owner = items[0];
      const declared = AdminMenuAreaService.declared(bucket.key, allPlugins);
      finalMenu.push({
        // The area's own name. The localizer reads `admin.groups.<key>` from the owning plugin's
        // dictionary and puts the translation here, so the row reads in the operator's language.
        label: bucket.groupName,
        // The AREA's own mark, declared by the plugin that owns the work. An area is not a plugin, so
        // it must not wear one's icon: taking the first page's plugin put a gift box on "Growth" (the
        // advent plugin happened to sort first) and a calculator on "Readings".
        icon: declared?.icon || 'Layers',
        group: bucket.groupName,
        groupKey: bucket.key,
        // Anchored to its first page's real path, so the sub-menu previews on hover like any section.
        path: String(owner.path || '').trim() || `/#area-${bucket.key}`,
        children: items,
        isGroup: true,
        // An AREA, as opposed to a plugin's own dropdown: the localizer names this row by the area.
        isArea: true,
        priority: declared?.priority ?? (owner.priority || 50),
        pluginSlug: owner.pluginSlug,
      });
    });

    const sorted = finalMenu.sort((a, b) => (a.priority || 0) - (b.priority || 0));

    return CoreServices.getInstance().menu.deduplicate(sorted);
  }

  /**
   * Every plugin menu item names the permission that opens it, so the sidebar, a bookmarked URL and
   * the API all answer from one rule. An item that declares its own `permission` keeps it. Otherwise a
   * screen that IS a collection list needs that collection's `read`, and any other screen of the
   * plugin needs `<plugin>:manage` — the permission the plugin route gate asks of its undeclared routes.
   */
  private withPermission(item: any, slug: string, collections: ICollection[]): any {
    const children = Array.isArray(item?.children)
      ? item.children.map((child: any) => this.withPermission(child, slug, collections))
      : item?.children;
    const declared = String(item?.permission ?? '').trim();
    if (declared || !item?.path) return { ...item, children };

    const segments = AdminRouteUtils.normalizePathSegments(item.path);
    const key = segments[0] === slug ? (segments[1] ?? slug) : segments[0];
    const collection = segments.length <= 2
      ? collections.find((col) => [col.shortSlug, (col as any).unprefixedSlug, col.slug].some((candidate) => String(candidate ?? '').toLowerCase() === key))
      : undefined;
    const permission = collection
      ? PermissionNames.collection(slug, PermissionNames.collectionKey(collection), CollectionPermissionAction.READ)
      : PermissionNames.pluginManage(slug);
    return { ...item, children, permission };
  }
}

import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { RoutingPageUtils } from '@/app/settings/routing/routing-page-utils';

/**
 * What the "home page shows" dropdown offers, assembled from the theme's layouts, the site's
 * collections and the framework's own targets.
 *
 * Split out of `page.client.tsx` (599 lines). The page decides WHEN to rebuild the list and what to
 * do with it; this decides what is in it.
 */
export class RoutingHomeOptions {
  /**
   * The option list for "what does the home page show".
   *
   * Everything it needs arrives as input and the sorted list comes back — it touches no component
   * state. It was a method on the page that read four `@state` fields and assigned a fifth, so the
   * only way to check the grouping, the de-duplication or the search filter was to render the page
   * and look, which meant none of it was checked. The page keeps the request-id guard and the
   * assignment; the decisions live here.
   *
   * It is async because it READS: the collection entries are fetched per candidate collection, and a
   * collection that fails to answer contributes nothing rather than failing the whole list.
   */
  static async build(input: {
    searchTerm: string;
    frontendMeta: any;
    availableCollections: any[];
    collections: any[];
  }): Promise<{ label: string; value: string; group?: string; section?: string; sourceKind?: string }[]> {
    const query = input.searchTerm.trim().toLowerCase();
    const frontendMeta = input.frontendMeta;
    const options: { label: string; value: string; group?: string; section?: string; sourceKind?: string }[] = [{ value: 'auto', label: 'Auto detect', group: 'System', sourceKind: 'Auto' }];
    const optionSet = new Set(options.map((o) => o.value));
    const availableCollectionSet = new Set(
      (input.availableCollections || [])
        .flatMap((c: any) => [String(c?.shortSlug || ''), String(c?.slug || '')])
        .filter(Boolean)
    );

    const rawLayouts = frontendMeta?.activeTheme?.layouts;
    const themeLayoutEntries = Array.isArray(rawLayouts)
      ? rawLayouts.map((layout: any, idx: number) => {
        if (typeof layout === 'string') return { key: layout, label: layout };
        const key = String(layout?.slug || layout?.name || layout?.key || layout?.id || `layout-${idx + 1}`);
        const label = String(layout?.title || layout?.label || layout?.name || layout?.slug || key);
        return { key, label };
      })
      : Object.entries(rawLayouts || {}).map(([key, layout]: [string, any]) => {
        if (typeof layout === 'string') return { key, label: layout };
        const label = String(layout?.title || layout?.label || layout?.name || layout?.slug || key);
        return { key, label };
      });

    themeLayoutEntries.forEach(({ key, label }) => {
      const value = `layout:${key}`;
      if (optionSet.has(value)) return;
      if (query && !label.toLowerCase().includes(query)) return;
      optionSet.add(value);
      options.push({
        value,
        label,
        group: 'Theme Layouts',
        sourceKind: 'Layout'
      });
    });

    const collectionCandidates = (input.collections || []).filter((c: any) => {
      if (!c || c.system) return false;
      if (availableCollectionSet.size > 0) {
        const shortSlug = String(c.shortSlug || c.slug || '');
        const fullSlug = String(c.slug || '');
        if (!availableCollectionSet.has(shortSlug) && !availableCollectionSet.has(fullSlug)) return false;
      } else {
        // If system collection stats are unavailable, avoid probing unknown collection routes.
        return false;
      }
      const fields = Array.isArray(c.fields) ? c.fields : [];
      return fields.some((f: any) => f.name === 'slug');
    });

    const docsResponses = await Promise.all(
      collectionCandidates.map(async (c: any) => {
        const collectionSlug = c.shortSlug || c.slug;
        const limit = query ? 150 : 50;
        try {
          const response = await AdminApi.get(`${AdminConstants.ENDPOINTS.COLLECTIONS.BASE}/${collectionSlug}?limit=${limit}&sort=title`);
          return { collection: c, collectionSlug, docs: response?.docs || [] };
        } catch {
          return { collection: c, collectionSlug, docs: [] };
        }
      })
    );

    docsResponses.forEach(({ collection, collectionSlug, docs }) => {
      docs.forEach((doc: any) => {
        if (!doc || doc.id === undefined || doc.id === null) return;
        const value = `collection:${collectionSlug}:${doc.id}`;
        if (optionSet.has(value)) return;

        const collectionLabel = collection.label || collection.name || collection.shortSlug || collectionSlug;
        const title = RoutingPageUtils.getRecordDisplayTitle(doc, collectionLabel);
        const permalink = doc.customPermalink || doc.slug || '';
        const permalinkLabel = permalink ? `/${String(permalink).replace(/^\/+/, '')}` : '/';
        const searchableText = `${title} ${permalinkLabel} ${collectionLabel}`.toLowerCase();
        if (query && !searchableText.includes(query)) return;

        const pluginSlug = collection.pluginSlug || 'System';
        const pluginLabel = pluginSlug.charAt(0).toUpperCase() + pluginSlug.slice(1);
        const groupLabel = `Collection Records · ${pluginLabel}`;
        const sourceTag = RoutingPageUtils.getCollectionSourceTag(pluginSlug, collectionLabel);

        optionSet.add(value);
        options.push({
          value,
          label: `${title} (${permalinkLabel})`,
          group: groupLabel,
          section: collectionLabel,
          sourceKind: sourceTag
        });
      });
    });

    const groupOrder = new Map<string, number>([
      ['System', 0],
      ['Theme Layouts', 1]
    ]);
    const sortedOptions = [...options].sort((a, b) => {
      const aGroup = a.group || 'Options';
      const bGroup = b.group || 'Options';
      const aSection = a.section || '';
      const bSection = b.section || '';
      const aRank = groupOrder.has(aGroup) ? groupOrder.get(aGroup)! : 2;
      const bRank = groupOrder.has(bGroup) ? groupOrder.get(bGroup)! : 2;
      if (aRank !== bRank) return aRank - bRank;
      if (aGroup !== bGroup) return aGroup.localeCompare(bGroup);
      if (aSection !== bSection) return aSection.localeCompare(bSection);
      return a.label.localeCompare(b.label);
    });

    return sortedOptions;
  }

  /** Resolve what "auto" currently points at (replaces the `[deps]` effect + `cancelled` flag). */
}

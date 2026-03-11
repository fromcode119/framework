type PluginCollectionLike = {
  slug?: string;
  shortSlug?: string;
  unprefixedSlug?: string;
};

export class AdminRouteUtils {
  static normalizePathSegments(pathValue: string): string[] {
      return String(pathValue || '')
        .trim()
        .toLowerCase()
        .split('?')[0]
        .split('#')[0]
        .split('/')
        .filter(Boolean);

  }

  static buildCollectionRouteKeySet(collections: PluginCollectionLike[]): Set<string> {
      const keys = new Set<string>();
      for (const collection of collections) {
        const candidates = [collection.shortSlug, collection.unprefixedSlug, collection.slug]
          .map((value) => String(value || '').trim().toLowerCase())
          .filter(Boolean);
        for (const candidate of candidates) keys.add(candidate);
      }
      return keys;

  }

  static isCollectionMenuPath(pathValue: string, pluginSlug: string, collectionRouteKeys: Set<string>): boolean {
      const segments = AdminRouteUtils.normalizePathSegments(pathValue);
      if (!segments.length || segments[0] !== pluginSlug) return false;

      // /plugin -> collection root route (used by plugins that expose a primary collection)
      if (segments.length === 1) {
        return collectionRouteKeys.has(pluginSlug);
      }

      return collectionRouteKeys.has(segments[1]);

  }

  static expectedPageSlotFromPath(pathValue: string, pluginSlug: string): string | null {
      const segments = AdminRouteUtils.normalizePathSegments(pathValue);
      if (!segments.length || segments[0] !== pluginSlug) return null;
      return `admin.plugin.${pluginSlug}.page.${segments.join('.')}`;

  }
}
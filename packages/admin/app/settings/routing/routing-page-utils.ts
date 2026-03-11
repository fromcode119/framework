/**
 * Utility class for routing settings page operations.
 * Handles record title resolution, collection metadata, and layout detection.
 */
export class RoutingPageUtils {
  private static readonly PRIMARY_TITLE_KEYS = [
    'title', 'name', 'label', 'slug', 'path', 'customPermalink', 'permalink'
  ];
  private static readonly SKIP_STRING_KEYS = new Set([
    'id', 'createdAt', 'updatedAt', '_status', '_locale', '_meta', '__v'
  ]);

  /**
   * Resolves a display title for a record from its properties.
   * 
   * @param doc - Record object
   * @param collectionLabel - Collection label for fallback
   * @returns Display title
   * 
   * @example
   * const title = RoutingPageUtils.getRecordDisplayTitle(
   *   { title: 'Hello World', id: 1 },
   *   'Posts'
   * ); // "Hello World"
   */
  static getRecordDisplayTitle(doc: any, collectionLabel: string): string {
    // Try primary title keys first
    for (const key of RoutingPageUtils.PRIMARY_TITLE_KEYS) {
      const value = doc?.[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
    }

    // Fallback: try any string field
    for (const [key, value] of Object.entries(doc || {})) {
      if (RoutingPageUtils.SKIP_STRING_KEYS.has(key)) continue;
      if (typeof value === 'string' && value.trim()) return value.trim();
    }

    return `${collectionLabel} #${doc?.id ?? 'unknown'}`;
  }

  /**
   * Creates a source tag for collection identification.
   * 
   * @param pluginLabel - Plugin label
   * @param collectionLabel - Collection label
   * @returns Source tag (e.g., 'CMS/Pages')
   * 
   * @example
   * const tag = RoutingPageUtils.getCollectionSourceTag('CMS', 'Pages'); // "CMS/Pages"
   */
  static getCollectionSourceTag(pluginLabel: string, collectionLabel: string): string {
    const plugin = (pluginLabel || 'System').trim();
    const section = (collectionLabel || 'record').trim();
    return `${plugin}/${section}`;
  }

  /**
   * Extracts field names from a collection definition.
   * 
   * @param collection - Collection object
   * @returns Set of field names
   * 
   * @example
   * const fields = RoutingPageUtils.getFieldNames({
   *   fields: [{ name: 'title' }, { name: 'content' }]
   * }); // Set(['title', 'content'])
   */
  static getFieldNames(collection: any): Set<string> {
    const fields = Array.isArray(collection?.fields) ? collection.fields : [];
    return new Set(fields.map((f: any) => String(f?.name || '').trim()).filter(Boolean));
  }

  /**
   * Calculates auto-collection priority based on field presence.
   * Lower scores indicate higher priority.
   * 
   * @param collection - Collection object
   * @returns Priority score (lower = higher priority)
   * 
   * @example
   * const priority = RoutingPageUtils.getAutoCollectionPriority({
   *   fields: [{ name: 'content' }, { name: 'themeLayout' }]
   * }); // Lower score due to content + themeLayout fields
   */
  static getAutoCollectionPriority(collection: any): number {
    const fields = RoutingPageUtils.getFieldNames(collection);
    let score = 100;

    if (fields.has('content')) score -= 30;
    if (fields.has('themeLayout')) score -= 20;
    if (fields.has('customPermalink') || fields.has('path')) score -= 20;
    if (fields.has('title') || fields.has('name')) score -= 10;

    return score;
  }

  /**
   * Detects a fallback layout from frontend theme metadata.
   * 
   * @param frontendMeta - Frontend metadata object
   * @returns Fallback layout name or null
   * 
   * @example
   * const layout = RoutingPageUtils.detectAutoFallbackLayout({
   *   activeTheme: { layouts: ['DefaultLayout', 'Home'] }
   * }); // "DefaultLayout"
   */
  static detectAutoFallbackLayout(frontendMeta: any): string | null {
    const rawLayouts = frontendMeta?.activeTheme?.layouts;
    const layoutKeys = Array.isArray(rawLayouts)
      ? rawLayouts
          .map((layout: any) =>
            String(layout?.slug || layout?.name || layout?.key || layout?.id || ''))
          .filter(Boolean)
      : Object.keys(rawLayouts || {});

    const fallbackPriority = ['DefaultLayout', 'Home', 'Main'];
    const matched = fallbackPriority.find((name) => layoutKeys.includes(name));
    return matched || null;
  }
}

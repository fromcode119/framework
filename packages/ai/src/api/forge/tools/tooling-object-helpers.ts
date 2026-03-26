import { PluginManager } from '@fromcode119/core';

export class AssistantToolingObjectHelpers {
  static toAssistantSlug(value: string, fallback: string = 'item'): string {
    const normalized = String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s\-_]/g, '')
      .replace(/[\s_]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    return normalized || fallback;
  }

  static toAssistantTitle(value: string, fallback: string): string {
    return String(value || '').trim() || fallback;
  }

  static readPluginConfig(manager: PluginManager, slug: string): Record<string, any> {
    const plugin = manager
      .getPlugins()
      .find((entry: any) => String(entry?.manifest?.slug || '').trim().toLowerCase() === slug);
    const config = plugin?.manifest?.config;
    return config && typeof config === 'object' ? { ...config } : {};
  }

  static collectObjectStringMatches(
    value: any,
    queryLower: string,
    queryTokens: string[],
    basePath: string,
    collectNestedMatches: (
      nestedValue: any,
      nextQueryLower: string,
      nextQueryTokens: string[],
      nextPath: string,
      depth: number,
      maxDepth: number,
    ) => Array<{ path: string; value: string }>,
    textMatchesQuery: (value: string, nextQueryLower: string, nextQueryTokens: string[]) => boolean,
    isPotentialLocaleKey: (key: string) => boolean,
    depth: number = 0,
    maxDepth: number = 5,
  ): Array<{ path: string; value: string }> {
    if (depth > maxDepth || value === null || value === undefined) return [];

    if (typeof value === 'string') {
      return textMatchesQuery(value, queryLower, queryTokens) ? [{ path: basePath || 'value', value }] : [];
    }

    if (Array.isArray(value)) {
      return value.flatMap((entry, index) =>
        collectNestedMatches(entry, queryLower, queryTokens, `${basePath}[${index}]`, depth + 1, maxDepth),
      );
    }

    if (typeof value === 'object') {
      return Object.entries(value).flatMap(([rawKey, nestedValue]) => {
        const key = String(rawKey || '').trim();
        if (!key || key.startsWith('_')) return [];
        const keySegment = isPotentialLocaleKey(key) ? `[${key}]` : key;
        const nextPath = basePath ? `${basePath}.${keySegment}` : keySegment;
        return collectNestedMatches(nestedValue, queryLower, queryTokens, nextPath, depth + 1, maxDepth);
      });
    }

    return [];
  }
}

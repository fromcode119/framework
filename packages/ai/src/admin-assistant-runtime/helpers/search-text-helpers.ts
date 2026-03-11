/** Pure text/search utility methods extracted from AdminAssistantRuntime. */
export class SearchTextHelpers {
  static isPotentialLocaleKey(key: string): boolean {
    return /^[a-z]{2}(?:-[a-z]{2})?$/i.test(String(key || '').trim());
  }

  static normalizeSearchText(value: string): string {
    return String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  static tokenizeSearchQuery(query: string): string[] {
    return SearchTextHelpers.normalizeSearchText(query)
      .split(' ')
      .map((t) => t.trim())
      .filter((t) => t.length >= 2);
  }

  static escapeRegExp(text: string): string {
    return String(text || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  static replaceTextInsensitive(value: string, from: string, to: string): string {
    const source = String(value || '');
    const fromText = String(from || '').trim();
    if (!fromText) return source;
    const pattern = new RegExp(SearchTextHelpers.escapeRegExp(fromText), 'gi');
    return source.replace(pattern, String(to || ''));
  }

  static decodeHtmlEntities(value: string): string {
    const source = String(value || '');
    if (!source) return '';
    return source
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;|&apos;/gi, "'")
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>');
  }

  static htmlToPlainText(html: string): string {
    const source = String(html || '');
    if (!source) return '';
    const withoutScripts = source.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ');
    const withoutStyles = withoutScripts.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ');
    const withoutTags = withoutStyles.replace(/<\/?[^>]+>/g, ' ');
    return SearchTextHelpers.decodeHtmlEntities(withoutTags).replace(/\s+/g, ' ').trim();
  }

  static extractHtmlTitle(html: string): string | undefined {
    const source = String(html || '');
    if (!source) return undefined;
    const match = source.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = SearchTextHelpers.decodeHtmlEntities(String(match?.[1] || '').trim());
    return title || undefined;
  }

  static extractHtmlLinks(html: string, baseUrl: string, limit: number): string[] {
    const source = String(html || '');
    if (!source) return [];
    const output: string[] = [];
    const seen = new Set<string>();
    const max = Math.max(1, Math.min(30, Number(limit || 10)));
    const regex = /<a\b[^>]*href=(["'])(.*?)\1/gi;
    let match: RegExpExecArray | null = null;
    while ((match = regex.exec(source))) {
      if (output.length >= max) break;
      const href = String(match?.[2] || '').trim();
      if (!href || href.startsWith('#') || /^javascript:/i.test(href)) continue;
      let resolved = href;
      try { resolved = new URL(href, baseUrl).toString(); } catch { continue; }
      if (seen.has(resolved)) continue;
      seen.add(resolved);
      output.push(resolved);
    }
    return output;
  }

  static tokenVariants(token: string): string[] {
    const normalized = String(token || '').trim().toLowerCase();
    if (!normalized) return [];
    const variants = new Set<string>([normalized]);
    if (normalized.endsWith('s') && normalized.length > 3) variants.add(normalized.slice(0, -1));
    else if (!normalized.endsWith('s') && normalized.length > 3) variants.add(`${normalized}s`);
    return Array.from(variants);
  }

  static normalizeWebUrl(input: string): URL {
    const raw = String(input || '').trim();
    if (!raw) throw new Error('Missing URL');
    const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    let parsed: URL;
    try { parsed = new URL(candidate); } catch { throw new Error('Invalid URL'); }
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Only HTTP/HTTPS URLs are supported');
    return parsed;
  }

  static textMatchesQuery(value: string, queryLower: string, queryTokens: string[]): boolean {
    const normalized = SearchTextHelpers.normalizeSearchText(value);
    if (!normalized) return false;
    if (queryLower && normalized.includes(queryLower)) return true;
    if (!queryTokens.length) return false;
    return queryTokens.every((token) =>
      SearchTextHelpers.tokenVariants(token).some((variant) => normalized.includes(variant)),
    );
  }

  static collectStringMatches(
    value: any, queryLower: string, queryTokens: string[], basePath: string,
    depth: number = 0, maxDepth: number = 5,
  ): Array<{ path: string; value: string }> {
    if (depth > maxDepth || value === null || value === undefined) return [];
    if (typeof value === 'string') {
      if (!SearchTextHelpers.textMatchesQuery(value, queryLower, queryTokens)) return [];
      return [{ path: basePath || 'value', value }];
    }
    if (Array.isArray(value)) {
      const out: Array<{ path: string; value: string }> = [];
      for (let i = 0; i < value.length; i += 1)
        out.push(...SearchTextHelpers.collectStringMatches(value[i], queryLower, queryTokens, `${basePath}[${i}]`, depth + 1, maxDepth));
      return out;
    }
    if (typeof value === 'object') {
      const out: Array<{ path: string; value: string }> = [];
      for (const [rawKey, nested] of Object.entries(value)) {
        const key = String(rawKey || '').trim();
        if (!key || key.startsWith('_')) continue;
        const seg = SearchTextHelpers.isPotentialLocaleKey(key) ? `[${key}]` : key;
        const next = basePath ? `${basePath}.${seg}` : seg;
        out.push(...SearchTextHelpers.collectStringMatches(nested, queryLower, queryTokens, next, depth + 1, maxDepth));
      }
      return out;
    }
    return [];
  }

  static collectStringPayloadEntries(value: any, basePath: string = ''): Array<{ path: string; value: string }> {
    if (typeof value === 'string') return [{ path: basePath || 'value', value }];
    if (Array.isArray(value)) {
      const out: Array<{ path: string; value: string }> = [];
      for (let i = 0; i < value.length; i += 1)
        out.push(...SearchTextHelpers.collectStringPayloadEntries(value[i], basePath ? `${basePath}[${i}]` : `[${i}]`));
      return out;
    }
    if (value && typeof value === 'object') {
      const out: Array<{ path: string; value: string }> = [];
      for (const [rawKey, nested] of Object.entries(value)) {
        const key = String(rawKey || '').trim();
        if (!key) continue;
        out.push(...SearchTextHelpers.collectStringPayloadEntries(nested, basePath ? `${basePath}.${key}` : key));
      }
      return out;
    }
    return [];
  }
}

import { ResponseDrain } from '@/lib/server-api/response-drain';

/**
 * The text of a theme's own built files (`ui.css`, the head boot script) that the document inlines.
 *
 * They used to be fetched from the API on EVERY page: `next: { revalidate }` only takes effect inside
 * an RSC render, and the storefront document is a route handler, so each visitor paid two API round
 * trips for files that had not changed. A URL that carries the theme's asset stamp (a digest of its
 * built files) names immutable content, so it is kept in process memory; a rebuild changes the stamp
 * and therefore the key. An unstamped URL is fetched every time, as before.
 */
export class ThemeAssetTextCache {
  private static readonly LIMIT = 32;
  private static readonly entries = new Map<string, Promise<string | null>>();

  /** The body of `url`, or null when it did not answer 200. */
  static async read(url: string, immutable: boolean): Promise<string | null> {
    if (!immutable) return ThemeAssetTextCache.fetchText(url);
    const cached = ThemeAssetTextCache.entries.get(url);
    if (cached) return cached;
    const pending = ThemeAssetTextCache.fetchText(url).then((text) => {
      // A failed fetch is not remembered: the next page asks again.
      if (text === null) ThemeAssetTextCache.entries.delete(url);
      return text;
    }, (error) => {
      ThemeAssetTextCache.entries.delete(url);
      throw error;
    });
    ThemeAssetTextCache.entries.set(url, pending);
    while (ThemeAssetTextCache.entries.size > ThemeAssetTextCache.LIMIT) {
      ThemeAssetTextCache.entries.delete(ThemeAssetTextCache.entries.keys().next().value as string);
    }
    return pending;
  }

  static clear(): void {
    ThemeAssetTextCache.entries.clear();
  }

  private static async fetchText(url: string): Promise<string | null> {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
      ResponseDrain.discard(response);
      return null;
    }
    return response.text();
  }
}

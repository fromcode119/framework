/**
 * Keeps an extension's server bundle ONE module graph per generation.
 *
 * `ThemeWorldBuilder` imports an entry as `entry.mjs?v=<generation>` so Node's module cache cannot answer
 * a rebuilt bundle with the previous one. The bundle's own chunks, though, import the entry back as a
 * plain `./entry.mjs` — no query, a different URL, so Node evaluated a SECOND copy of the whole entry the
 * first time a chunk loaded. That copy booted the theme again: it re-registered the theme's layouts and
 * brought its own copies of every module-level singleton, `ThemeRuntimeContext` included. The layout then
 * came from one copy and an override (the account shell) from the other, so the override read a context
 * nothing provided and painted raw translation keys the browser did not — a hydration mismatch.
 *
 * A relative import made from a cache-busted module therefore carries the same query, so every module of
 * the bundle resolves to the one instance the entry started.
 */
export class ThemeSsrModuleUrl {
  static carryCacheBuster(specifier: string, resolvedUrl: string, parentUrl: string): string {
    if (!ThemeSsrModuleUrl.isRelative(specifier)) return resolvedUrl;
    const parentQuery = ThemeSsrModuleUrl.queryOf(parentUrl);
    if (!parentQuery) return resolvedUrl;
    const resolved = new URL(resolvedUrl);
    if (resolved.protocol !== 'file:' || resolved.search) return resolvedUrl;
    resolved.search = parentQuery;
    return resolved.href;
  }

  private static isRelative(specifier: string): boolean {
    return specifier.startsWith('./') || specifier.startsWith('../');
  }

  private static queryOf(url: string): string {
    if (!url.startsWith('file:')) return '';
    return new URL(url).search;
  }
}

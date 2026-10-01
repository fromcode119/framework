/**
 * The routes a plugin DECLARED on the api (`context.api.get(path, { access, … }, handler)`), so a
 * catch-all it also mounted (`context.api.use('/', router)`) can step aside for them.
 *
 * On the api each registration becomes an Express layer in the order the plugin made it. A plugin that
 * mounts a sub-router at `/` before declaring a route — a shop that mounts its tags router before
 * `GET /products/:slug`, for ordering reasons of its own — got that route's requests caught by
 * the catch-all's forwarder: the route's own layers (its declared access gate, the anonymous response
 * cache) never ran for them. The plugin's own process routes the request identically either way.
 *
 * Paths are plugin routes: literal segments and `:param` segments.
 */
export class PluginHostDeclaredRoutes {
  private readonly routes: Array<{ method: string; segments: string[] }> = [];

  constructor(private readonly slug: string) {}

  /** `fullPath` as registered: `/<slug>/products/:slug`. */
  add(method: string, fullPath: string): void {
    this.routes.push({ method: method.toLowerCase(), segments: PluginHostDeclaredRoutes.split(fullPath) });
  }

  /** Whether `method` on `requestPath` (the path as the api received it, any prefix) is a declared route. */
  declares(method: string, requestPath: string): boolean {
    const marker = `/${this.slug}/`;
    const index = `${requestPath}/`.indexOf(marker);
    if (index < 0) return false;
    const segments = PluginHostDeclaredRoutes.split(requestPath.slice(index));
    const verb = method.toLowerCase() === 'head' ? 'get' : method.toLowerCase();
    return this.routes.some((route) => route.method === verb && PluginHostDeclaredRoutes.matches(route.segments, segments));
  }

  private static split(path: string): string[] {
    return String(path).split('?')[0].split('/').filter(Boolean);
  }

  private static matches(pattern: string[], segments: string[]): boolean {
    if (pattern.length !== segments.length) return false;
    return pattern.every((part, i) => (part.startsWith(':') ? segments[i].length > 0 : part === segments[i]));
  }
}

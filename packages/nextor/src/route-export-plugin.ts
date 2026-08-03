/**
 * Next.js resolves a route by EXPORT NAME: `GET`/`POST`/… for a route handler, `default` for a page or
 * layout, plus `generateMetadata`, `manifest`, `sitemap`. None of those may be a class.
 *
 * Rather than let that contract push `export const`/`export function`/`export default` bindings back into
 * source, this plugin generates them at BUILD time. Source files declare nothing but a class:
 *
 *   export class AppearanceUiRoute {
 *     static async GET(req: Request): Promise<Response> { … }
 *   }
 *
 * and the compiled module gains `export const GET = AppearanceUiRoute.GET;`. The rule stays absolute —
 * the only export written by hand, anywhere, is `export class`.
 *
 * Method name → generated export:
 *   GET/POST/PUT/PATCH/DELETE/HEAD/OPTIONS → same-named export (route handlers)
 *   render                                 → `export default` (page / layout / component)
 *   generateMetadata / generateViewport / generateStaticParams / manifest / sitemap / robots → same name
 *   proxy / middleware / config             → same name (middleware handler + its matcher config)
 */
export class RouteExportPlugin {
  /** Static method names that map straight onto a same-named Next export. */
  static readonly NAMED_EXPORTS = [
    'GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS',
    'generateMetadata', 'generateViewport', 'generateStaticParams',
    'manifest', 'sitemap', 'robots',
    // Middleware: Next reads the handler by name and its matcher from a `config` OBJECT — which is why
    // `config` is here even though it is a static property, not a method.
    'proxy', 'middleware', 'config',
  ];

  /** The static method whose value becomes the module's default export. */
  static readonly DEFAULT_EXPORT_METHOD = 'render';

  /**
   * Route kinds Next loads via the module's DEFAULT export. When such a file declares a component class
   * (a `Reactor` with an instance `render()`, not a static one), the class itself is the default export.
   * `route` is absent deliberately: a route handler is resolved by its named `GET`/`POST`/… exports.
   */
  static readonly DEFAULT_EXPORT_FILES =
    /^(page|layout|template|default|loading|error|not-found|global-error)$/;

  /**
   * Files Next resolves by export name — everything else is left untouched.
   *
   * The optional `.client` infix is not decoration: both apps set
   * `pageExtensions: ['client.tsx', 'client.ts', 'tsx', …]`, so `page.client.tsx` IS the route module.
   * Without it those files fall outside this plugin and are forced to hand-write `export default`.
   */
  static readonly filenamePattern =
    /(^|[\\/])(route|page|layout|template|default|loading|error|not-found|global-error|manifest|sitemap|robots|icon|apple-icon|opengraph-image|twitter-image|proxy|middleware)(\.client)?\.(t|j)sx?$/;

  static handles(path: string): boolean {
    return RouteExportPlugin.filenamePattern.test(path);
  }

  /** Name of the first exported class in the source, or null when there is none. */
  static exportedClassName(source: string): string | null {
    const match = /^export\s+class\s+([A-Za-z_$][\w$]*)/m.exec(source);
    return match ? match[1] : null;
  }

  /** Static method names declared on that class. */
  static staticMethodNames(source: string): string[] {
    const names: string[] = [];
    const pattern = /^\s{2}static\s+(?:async\s+)?(?:readonly\s+)?([A-Za-z_$][\w$]*)\s*[(=]/gm;
    let match = pattern.exec(source);
    while (match) {
      names.push(match[1]);
      match = pattern.exec(source);
    }
    return names;
  }

  /**
   * Append the exports Next needs. Idempotent: re-running on already-transformed source is a no-op,
   * so it is safe under watch mode and repeated loader passes.
   */
  static injectInto(source: string, path: string): string {
    if (!RouteExportPlugin.handles(path)) return source;
    const className = RouteExportPlugin.exportedClassName(source);
    if (!className) return source;

    const methods = RouteExportPlugin.staticMethodNames(source);
    const lines: string[] = [];

    // `app/manifest.ts`, `app/sitemap.ts`, `app/robots.ts` are read by Next as DEFAULT exports even
    // though the convention names them after the file — so a static matching the basename is the default.
    const basename = (path.split(/[\\/]/).pop() || '').replace(/(\.client)?\.(t|j)sx?$/, '');
    const defaultMethod = methods.includes(RouteExportPlugin.DEFAULT_EXPORT_METHOD)
      ? RouteExportPlugin.DEFAULT_EXPORT_METHOD
      : (['manifest', 'sitemap', 'robots'].includes(basename) && methods.includes(basename) ? basename : null);
    const hasDefault = /^export\s+default\s/m.test(source);
    if (defaultMethod && !hasDefault) {
      lines.push(`export default ${className}.${defaultMethod};`);
    } else if (!defaultMethod && !hasDefault && RouteExportPlugin.DEFAULT_EXPORT_FILES.test(basename)) {
      // A page/layout/loading/… whose class IS the component (a `Reactor` with an instance `render()`).
      // Next wants the class itself as the default; the class stays the only hand-written export.
      lines.push(`export default ${className};`);
    }
    for (const name of RouteExportPlugin.NAMED_EXPORTS) {
      if (!methods.includes(name)) continue;
      if (name === defaultMethod) continue;
      if (new RegExp(`^export\\s+(const|let|var|function|async function)\\s+${name}\\b`, 'm').test(source)) continue;
      lines.push(`export const ${name} = ${className}.${name};`);
    }
    if (!lines.length) return source;

    return `${source}\n\n// [nextor] Generated at build time from ${className} — Next resolves routes by export\n// name, and only \`export class\` is written by hand. See RouteExportPlugin.\n${lines.join('\n')}\n`;
  }
}

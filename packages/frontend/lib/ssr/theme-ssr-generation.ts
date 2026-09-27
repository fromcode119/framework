import { createHash } from 'node:crypto';
import { ThemeSsrBundles } from '@/lib/ssr/theme-ssr-bundles';

/**
 * Which artifact versions the server-rendered world was built from: the active theme's version plus
 * every active plugin's, exactly as the API reports them in `/system/frontend`.
 *
 * This class exists because of a live incident. The SSR bundles are imported ONCE per process and
 * Node's ESM cache is keyed by URL, so after a theme was updated in the admin the frontend kept
 * running the PREVIOUS `ui-ssr/entry.mjs` — and, worse, kept its "bundle file missing" verdict from
 * before the artifact existed. Pages rendered empty until someone SSH'd in and restarted the
 * container. Comparing this signature on every request is what tells the renderer its imported world
 * is stale; `token` is what busts the import cache.
 *
 * It costs no extra work per request: the payload it reads is the same `/system/frontend` config the
 * render already awaits through `FrontendConfigCache`, which is memoized per request.
 */
export class ThemeSsrGeneration {
  /** Slug of the active theme, or `''` when the config names none. */
  readonly themeSlug: string;

  /** Human-readable, stable across processes — what gets logged when the SSR world is rebuilt. */
  readonly signature: string;

  /** Short cache-buster appended to every bundle URL. Same signature → same token. */
  readonly token: string;

  /**
   * The plugins this site runs — the only ones whose server bundles its world may import. The browser
   * loads exactly this set, so a server world holding any other plugin's registrations renders markup
   * the client can never reproduce (see `ThemeWorldBuilder.build`).
   */
  readonly pluginSlugs: ReadonlySet<string>;

  private constructor(themeSlug: string, signature: string, pluginSlugs: string[]) {
    this.themeSlug = themeSlug;
    this.signature = signature;
    this.pluginSlugs = new Set(pluginSlugs);
    this.token = createHash('sha1').update(signature).digest('hex').slice(0, 12);
  }

  static from(config: Record<string, unknown> | null, stampOf: (entry: string) => string = ThemeSsrBundles.stamp): ThemeSsrGeneration {
    const activeTheme = (config?.activeTheme ?? null) as Record<string, unknown> | null;
    const themeSlug = String(activeTheme?.slug || '').trim();
    const themeVersion = String(activeTheme?.version || '').trim();

    const plugins = Array.isArray(config?.plugins) ? (config?.plugins as Record<string, unknown>[]) : [];
    const pluginParts = plugins
      .map((plugin) => ({
        slug: String(plugin?.slug || '').trim(),
        version: String(plugin?.version || '').trim(),
      }))
      .filter((plugin) => Boolean(plugin.slug))
      // Sorted so the signature depends on WHICH versions are active, not on the order the API
      // happened to sort its plugin list in — otherwise a plugin load-order change alone would
      // throw away and re-import every bundle.
      .sort((left, right) => left.slug.localeCompare(right.slug));

    // Each part carries the stamp of the bundle on disk, so a rebuild at the same version is a new
    // generation too (see `ThemeSsrBundles`). No stamp when the file is absent — the version alone.
    const part = (kind: string, slug: string, version: string, entry: string) => {
      const stamp = slug ? stampOf(entry) : '';
      return `${kind}:${slug}@${version}${stamp ? `#${stamp}` : ''}`;
    };
    return new ThemeSsrGeneration(
      themeSlug,
      [
        part('theme', themeSlug, themeVersion, ThemeSsrBundles.themeEntry(themeSlug)),
        ...pluginParts.map((plugin) => part('plugin', plugin.slug, plugin.version, ThemeSsrBundles.pluginEntry(plugin.slug))),
      ].join('|'),
      pluginParts.map((plugin) => plugin.slug),
    );
  }

  matches(other: ThemeSsrGeneration | null): boolean {
    return Boolean(other) && other?.signature === this.signature;
  }
}

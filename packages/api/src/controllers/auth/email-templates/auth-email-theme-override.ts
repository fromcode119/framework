import path from 'path';

/**
 * Where the active site's theme keeps its own copies of the framework's email templates:
 * `<theme>/src/overrides/framework/emails/<language>/<file>`, laid out exactly like this package's
 * `templates/` folder. A theme that ships `bg/password-reset.html` there is what its Bulgarian readers
 * get; anything it does not ship comes from the framework.
 *
 * The site is the one bound to the request, so each site's theme decides its own mail.
 */
export class AuthEmailThemeOverride {
  static readonly DIRECTORY = path.join('src', 'overrides', 'framework', 'emails');

  private static themes: {
    getActiveThemeManifest(): { slug: string } | null;
    getThemeDirectory(slug: string): string;
    getActiveThemeVariables(): Promise<Record<string, unknown>>;
  } | null = null;

  /** Wired once at API boot with the theme manager. Before that, no theme overrides anything. */
  static configure(themes: typeof AuthEmailThemeOverride.themes | null): void {
    AuthEmailThemeOverride.themes = themes;
  }

  /** The active theme's variables for the site (contact email, social links, …) — every email template gets them. */
  static async variables(): Promise<Record<string, unknown>> {
    if (!AuthEmailThemeOverride.themes) return {};
    return AuthEmailThemeOverride.themes.getActiveThemeVariables().catch(() => ({}));
  }

  /** The slug of the theme the current request's site renders with, or null when none is active. */
  static async activeSlug(): Promise<string | null> {
    return String(AuthEmailThemeOverride.themes?.getActiveThemeManifest()?.slug || '').trim() || null;
  }

  /** The active theme's email override folder, or null when no theme is active. */
  static root(): string | null {
    const slug = String(AuthEmailThemeOverride.themes?.getActiveThemeManifest()?.slug || '').trim();
    if (!slug || !AuthEmailThemeOverride.themes) return null;
    return path.join(AuthEmailThemeOverride.themes.getThemeDirectory(slug), AuthEmailThemeOverride.DIRECTORY);
  }
}

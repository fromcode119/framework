import type { IThemeManifest } from '@core/theme/interfaces/theme-manifest.interface';
import { SystemConstants } from '@core/constants/system.constants';
import { ThemeState } from '@core/theme/enums/theme-state.enum';
import { ThemeAssetFingerprintService } from '@core/theme/theme-asset-fingerprint-service';

/**
 * ThemeConfigService
 *
 * Theme configuration persistence (variables) plus frontend metadata / CSS
 * variable rendering. Extracted from ThemeManager to keep that class under the
 * size limit; the manager delegates these reads/writes here with identical
 * behavior. Active-theme lifecycle (activate/disable/delete) stays on the manager.
 */
export class ThemeConfigService {
  constructor(
    private db: any,
    private themes: Map<string, IThemeManifest>,
  ) {}

  /** The shape rules on their own, so the per-tenant path can validate without writing the platform row. */
  // `config` is an HTTP request body (see theme-controller.ts `saveConfig`), not a trusted object —
  // the shape `assertValidThemeConfigShape` declares is what this validates,
  // not what is guaranteed on entry.
  validateThemeConfig(slug: string, config: Record<string, unknown>): void {
    if (!this.themes.has(slug)) throw new Error(`Theme "${slug}" not found.`);
    ThemeConfigService.assertValidThemeConfigShape(config);
    ThemeConfigService.assertDeclaredLayout(this.themes.get(slug)!, config.defaultLayout);
  }

  async saveThemeConfig(slug: string, config: Record<string, unknown>) {
    if (!this.themes.has(slug)) throw new Error(`Theme "${slug}" not found.`);
    ThemeConfigService.assertValidThemeConfigShape(config);
    ThemeConfigService.assertDeclaredLayout(this.themes.get(slug)!, config.defaultLayout);
    const existing = await this.db.findOne(SystemConstants.TABLE.THEMES, { slug });
    if (existing) {
      await this.db.update(SystemConstants.TABLE.THEMES, { slug }, { config: JSON.stringify(config), updated_at: new Date() });
    } else {
      const manifest = this.themes.get(slug)!;
      await this.db.insert(SystemConstants.TABLE.THEMES, { slug, name: manifest.name, version: manifest.version, state: ThemeState.INACTIVE.value, config: JSON.stringify(config), created_at: new Date(), updated_at: new Date() });
    }
  }

  /**
   * The keys the theme settings page writes. `settings` holds whatever the theme declares — nested
   * objects included (a theme's email copy, form defaults) — so only its outer shape is checked here.
   * `defaultLayout` is the site's choice of layout for pages that name none; empty means the theme's
   * own `defaultLayout`. Accepting `variables` alone made every save from that page fail.
   */
  private static readonly CONFIG_KEYS = ['variables', 'defaultLayout', 'settings'];

  private static assertValidThemeConfigShape(config: Record<string, unknown>): void {
    const extraKeys = Object.keys(config).filter((k) => !ThemeConfigService.CONFIG_KEYS.includes(k));
    if (extraKeys.length > 0) throw new Error(`Unknown theme config keys: ${extraKeys.join(', ')}`);
    ThemeConfigService.assertStringMap(config.variables, 'Theme variables', 'Theme variable');
    if (config.defaultLayout !== undefined && typeof config.defaultLayout !== 'string') {
      throw new Error('Theme default layout must be a string.');
    }
    if (config.settings !== undefined && !ThemeConfigService.isPlainObject(config.settings)) {
      throw new Error('Theme settings must be a plain object.');
    }
  }

  /** A site may only pick a layout its theme declares; anything else would render nothing. */
  private static assertDeclaredLayout(theme: IThemeManifest, layout: unknown): void {
    if (!layout) return;
    if (!ThemeConfigService.declaresLayout(theme, String(layout))) {
      throw new Error(`Theme "${theme.slug}" declares no layout named "${layout}".`);
    }
  }

  private static declaresLayout(theme: IThemeManifest, name: string): boolean {
    return (theme.layouts || []).some((layout) => layout.name === name);
  }

  /**
   * The layout a page gets when it names none: the site's own choice when it still names a layout the
   * theme declares, otherwise the theme's `defaultLayout`. A choice the theme no longer declares (a
   * theme update dropped it) is not honoured — the admin shows it as unavailable.
   */
  static resolveDefaultLayout(theme: IThemeManifest, config: Record<string, unknown>): string {
    const siteChoice = String(config.defaultLayout || '');
    if (siteChoice && ThemeConfigService.declaresLayout(theme, siteChoice)) return siteChoice;
    return String((theme as any).defaultLayout || '');
  }

  private static assertStringMap(value: unknown, what: string, entry: string): void {
    if (value === undefined) return;
    if (!ThemeConfigService.isPlainObject(value)) throw new Error(`${what} must be a plain object.`);
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (typeof item !== 'string') throw new Error(`${entry} "${key}" must be a string.`);
    }
  }

  private static isPlainObject(value: unknown): boolean {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  async getThemeConfig(slug: string): Promise<any> {
    const row = await this.db.findOne(SystemConstants.TABLE.THEMES, { slug });
    return row?.config || {};
  }

  async getFrontendMetadata(
    theme: IThemeManifest | null,
    runtimeModules: Record<string, any> = {},
    configOverride?: Record<string, unknown>,
  ) {
    if (!theme) return { activeTheme: null, runtimeModules };
    // A tenant's overrides come from its own row (`configOverride`); the platform row is the single-tenant
    // source. Never both, never merged — that would let one site's variables leak into another.
    const config = configOverride !== undefined ? configOverride : await this.getThemeConfig(theme.slug);
    const variables = { ...(theme.variables || {}), ...(config.variables || {}) };
    const finalModules = { ...runtimeModules };
    const themeAny = theme as any;
    if (themeAny?.runtimeModules) Object.assign(finalModules, themeAny.runtimeModules);
    // What the frontend should cache-bust its asset URLs with. Empty when the files cannot be read,
    // and the frontend then falls back to `version` — never to a made-up token.
    const assetVersion = ThemeAssetFingerprintService.forThemeAssets(
      theme.slug,
      [...(Array.isArray(theme.ui?.css) ? theme.ui.css as string[] : []), String(theme.ui?.entry || '')]
    );
    return {
      // `defaultLayout` is the layout a page gets when it names none — the site's choice (admin theme
      // settings), else the theme's own declaration (`resolveDefaultLayout`). Without it here the frontend and the admin both fell back to a hardcoded
      // 'DefaultLayout' literal that no theme declares — the admin then reported
      // "LAYOUT NOT FOUND IN THEME" for a layout that silently worked via a theme-side alias.
      // `dependencies`: the plugins the theme's own code calls (theme.json). The storefront reads it to keep
      // those plugins' bundles on every page even when a page renders none of their components.
      activeTheme: { slug: theme.slug, version: (theme as any).version || '0.0.0', assetVersion, variables, ui: theme.ui, layouts: theme.layouts, defaultLayout: ThemeConfigService.resolveDefaultLayout(theme, config), slots: theme.slots || [], overrides: (theme as any).overrides || [], dependencies: ((theme as any).dependencies && typeof (theme as any).dependencies === 'object') ? (theme as any).dependencies : {} },
      runtimeModules: finalModules,
      cssVariables: this.generateCssVariables(variables),
    };
  }

  private generateCssVariables(variables: Record<string, string>): string {
    const lines = Object.entries(variables).map(([key, value]) => {
      const cssKey = key.startsWith('--') ? key : `--theme-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
      // Strip chars that can break out of the CSS context or close the surrounding <style> tag
      const safeValue = String(value).replace(/[<>"'\\]|\/\*/g, '');
      return `${cssKey}: ${safeValue};`;
    });
    return `:root {\n  ${lines.join('\n  ')}\n}`;
  }
}

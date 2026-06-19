import { ThemeManifest } from '../types';
import { SystemConstants } from '../constants';

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
    private themes: Map<string, ThemeManifest>,
  ) {}

  async saveThemeConfig(slug: string, config: { variables?: Record<string, string> }) {
    if (!this.themes.has(slug)) throw new Error(`Theme "${slug}" not found.`);
    const extraKeys = Object.keys(config).filter((k) => k !== 'variables');
    if (extraKeys.length > 0) throw new Error(`Unknown theme config keys: ${extraKeys.join(', ')}`);
    if (config.variables !== undefined) {
      if (typeof config.variables !== 'object' || Array.isArray(config.variables)) {
        throw new Error('Theme variables must be a plain object.');
      }
      for (const [key, value] of Object.entries(config.variables)) {
        if (typeof value !== 'string') throw new Error(`Theme variable "${key}" must be a string.`);
      }
    }
    const existing = await this.db.findOne(SystemConstants.TABLE.THEMES, { slug });
    if (existing) {
      await this.db.update(SystemConstants.TABLE.THEMES, { slug }, { config: JSON.stringify(config), updated_at: new Date() });
    } else {
      const manifest = this.themes.get(slug)!;
      await this.db.insert(SystemConstants.TABLE.THEMES, { slug, name: manifest.name, version: manifest.version, state: 'inactive', config: JSON.stringify(config), created_at: new Date(), updated_at: new Date() });
    }
  }

  async getThemeConfig(slug: string): Promise<any> {
    const row = await this.db.findOne(SystemConstants.TABLE.THEMES, { slug });
    return row?.config || {};
  }

  async getFrontendMetadata(theme: ThemeManifest | null, runtimeModules: Record<string, any> = {}) {
    if (!theme) return { activeTheme: null, runtimeModules };
    const config = await this.getThemeConfig(theme.slug);
    const variables = { ...(theme.variables || {}), ...(config.variables || {}) };
    const finalModules = { ...runtimeModules };
    const themeAny = theme as any;
    if (themeAny?.runtimeModules) Object.assign(finalModules, themeAny.runtimeModules);
    return {
      activeTheme: { slug: theme.slug, version: (theme as any).version || '0.0.0', variables, ui: theme.ui, layouts: theme.layouts, slots: theme.slots || [], overrides: (theme as any).overrides || [] },
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

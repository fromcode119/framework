import type { ILoadedPlugin } from '@core/interfaces/loaded-plugin.interface';
import type { IPluginManagerInterface } from '@core/plugin/context/interfaces/plugin-manager-interface.interface';

export class ThemeContextProxy {
  static createThemeProxy(plugin: ILoadedPlugin, manager: IPluginManagerInterface) {
    // The config of the theme the CURRENT site renders with — the site's own saved row, never the
    // platform row while a site is bound.
    const getActiveConfig = async (): Promise<Record<string, any>> => {
      if (!manager.themeManager) return {};
      return ThemeContextProxy.normalizeObject(await manager.themeManager.getActiveThemeConfig());
    };

    return {
      getActiveSlug: async (): Promise<string | null> => {
        const slug = String(manager.themeManager?.getActiveThemeManifest()?.slug || '').trim();
        return slug || null;
      },
      getActiveConfig,
      // The theme's variables as the site set them (contact email, social links, …) — what an email
      // template a theme overrides can print, exactly as the storefront does.
      getVariables: async (): Promise<Record<string, unknown>> => {
        if (!manager.themeManager) return {};
        return ThemeContextProxy.normalizeObject(await manager.themeManager.getActiveThemeVariables());
      },
      getCurrentPluginSettings: async (): Promise<Record<string, any>> => {
        const config = await getActiveConfig();
        const settings = ThemeContextProxy.normalizeObject(config.settings);
        return ThemeContextProxy.normalizeObject(settings[plugin.manifest.slug]);
      },
    };
  }

  private static normalizeObject(value: unknown): Record<string, any> {
    if (!value) {
      return {};
    }

    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
          ? parsed as Record<string, any>
          : {};
      } catch {
        return {};
      }
    }

    return typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, any>
      : {};
  }
}

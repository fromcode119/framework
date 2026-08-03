import type { ILoadedPlugin } from '@core/interfaces/loaded-plugin.interface';
import type { IPluginManagerInterface } from '@core/plugin/context/interfaces/plugin-manager-interface.interface';

export class ThemeContextProxy {
  static createThemeProxy(plugin: ILoadedPlugin, manager: IPluginManagerInterface) {
    const getActiveConfig = async (): Promise<Record<string, any>> => {
      const slug = String(manager.themeManager?.getActiveThemeManifest()?.slug || '').trim();
      if (!slug || !manager.themeManager) {
        return {};
      }

      const config = await manager.themeManager.getThemeConfig(slug);
      return ThemeContextProxy.normalizeObject(config);
    };

    return {
      getActiveSlug: async (): Promise<string | null> => {
        const slug = String(manager.themeManager?.getActiveThemeManifest()?.slug || '').trim();
        return slug || null;
      },
      getActiveConfig,
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

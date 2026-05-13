import { TranslationMap, LoadedPlugin } from '../../types';
import { LocalizationUtils } from '../../localization';
import type { PluginManagerInterface } from './utils.interfaces';
import { ContextSecurityProxy } from './utils';


export class I18nContextProxy {
  static createI18nProxy(
  plugin: LoadedPlugin,
  manager: PluginManagerInterface,
  security: ReturnType<typeof ContextSecurityProxy.createSecurityHelpers>
) {
      const { hasCapability, handleViolation } = security;
      const normalizeLocale = (locale?: string) => LocalizationUtils.normalizeLocaleCode(locale) || undefined;
      const scopePluginKey = (key: string) => `${plugin.manifest.slug}.${String(key || '').trim()}`;
      const scopeThemeKey = (key: string) => {
        const activeThemeSlug = String(manager.themeManager?.getActiveThemeManifest()?.slug || '').trim();
        return activeThemeSlug ? `${activeThemeSlug}.${String(key || '').trim()}` : String(key || '').trim();
      };
      const resolveScopedKey = (key: string, scope?: 'plugin' | 'theme' | null) => {
        if (scope === 'plugin') {
          return scopePluginKey(key);
        }
        if (scope === 'theme') {
          return scopeThemeKey(key);
        }
        return String(key || '').trim();
      };

      return {
        translate: (
          key: string,
          params?: Record<string, any>,
          locale?: string,
          scope?: 'plugin' | 'theme' | null,
        ) => {
          if (!hasCapability('i18n')) handleViolation('i18n');
          return manager.i18n.translate(resolveScopedKey(key, scope), params, normalizeLocale(locale));
        },
        translateOrFallback: (
          key: string,
          fallback: string,
          params?: Record<string, any>,
          locale?: string,
          scope?: 'plugin' | 'theme' | null,
        ) => {
          if (!hasCapability('i18n')) handleViolation('i18n');
          return manager.i18n.translateOrFallback(
            resolveScopedKey(key, scope),
            fallback,
            params,
            normalizeLocale(locale),
          );
        },
        t: (key: string, params?: Record<string, any>) => {
          if (!hasCapability('i18n')) handleViolation('i18n');
          return manager.i18n.translate(scopePluginKey(key), params);
        },
        registerTranslations: (locale: string, translations: any) => {
          if (!hasCapability('i18n')) handleViolation('i18n');
          manager.i18n.registerTranslations(locale, plugin.manifest.slug, translations as TranslationMap);
        }
      };

  }
}

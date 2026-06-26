import fs from 'fs';
import path from 'path';
import { TranslationMap, LoadedPlugin } from '../../types';
import { LocalizationUtils } from '../../localization';
import type { PluginManagerInterface } from './utils.interfaces';
import { ContextSecurityProxy } from './utils';

interface PluginPathContext {
  currentPluginRoot: string;
}


export class I18nContextProxy {
  static createI18nProxy(
  plugin: LoadedPlugin,
  manager: PluginManagerInterface,
  paths: PluginPathContext,
  security: ReturnType<typeof ContextSecurityProxy.createSecurityHelpers>
) {
      const { hasCapability, handleViolation } = security;
      const normalizeLocale = (locale?: string) => LocalizationUtils.normalizeLocaleCode(locale) || undefined;
      const registerTranslationsFromDirectory = (pluginDirectory: string = 'i18n') => {
        const normalizedDirectory = String(pluginDirectory || '').trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
        if (!normalizedDirectory || normalizedDirectory.startsWith('..')) {
          return;
        }

        const translationDirectory = path.join(paths.currentPluginRoot, normalizedDirectory);
        if (!fs.existsSync(translationDirectory) || !fs.statSync(translationDirectory).isDirectory()) {
          return;
        }

        for (const fileName of fs.readdirSync(translationDirectory)) {
          const normalizedFileName = String(fileName || '').trim();
          if (!normalizedFileName.endsWith('.json') || normalizedFileName.startsWith('.') || normalizedFileName.startsWith('._')) {
            continue;
          }

          const locale = normalizedFileName.replace(/\.json$/i, '').trim().toLowerCase();
          if (!locale) {
            continue;
          }

          try {
            const payload = JSON.parse(fs.readFileSync(path.join(translationDirectory, normalizedFileName), 'utf8'));
            if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
              manager.i18n.registerTranslations(locale, plugin.manifest.slug, payload as TranslationMap);
            }
          } catch (error) {
            void manager.writeLog(
              'warn',
              `[i18n] Failed to register translation file "${normalizedFileName}": ${String((error as any)?.message || error)}`,
              plugin.manifest.slug,
            );
          }
        }
      };
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
        /** The platform's configured default locale (admin Settings → Localization `default_locale`).
         *  Use for server-rendered legal documents that must render in the PLATFORM language, not the
         *  viewer's request locale — instead of hardcoding a country/locale literal. */
        defaultLocale: (): string => manager.i18n.getDefaultLocale(),
        registerTranslations: (localeOrDirectory: string = 'i18n', translations?: Record<string, any>) => {
          if (!hasCapability('i18n')) handleViolation('i18n');
          if (translations === undefined) {
            registerTranslationsFromDirectory(localeOrDirectory);
            return;
          }

          manager.i18n.registerTranslations(
            localeOrDirectory,
            plugin.manifest.slug,
            translations as TranslationMap,
          );
        }
      };

  }
}

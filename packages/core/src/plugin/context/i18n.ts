import { SiteClockAccess } from '@core/i18n/site-clock-access';
import type { IPluginPathContext } from '@core/plugin/context/interfaces/plugin-path-context.interface';
import { ExtensionKind } from '@core/plugin/enums/extension-kind.enum';
import fs from 'fs';
import path from 'path';
import type { ITranslationMap } from '@core/interfaces/translation-map.interface';
import type { ILoadedPlugin } from '@core/interfaces/loaded-plugin.interface';
import { LocalizationUtils } from '@core/localization';
import type { IPluginManagerInterface } from '@core/plugin/context/interfaces/plugin-manager-interface.interface';
import { ContextSecurityProxy } from '@core/plugin/context/utils';
import { RequestContextUtils } from '@core/context/request-context';

export class I18nContextProxy {
  static createI18nProxy(
  plugin: ILoadedPlugin,
  manager: IPluginManagerInterface,
  paths: IPluginPathContext,
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
              manager.i18n.registerTranslations(locale, plugin.manifest.slug, payload as ITranslationMap);
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
      const resolveScopedKey = (key: string, scope?: ExtensionKind | null) => {
        if (ExtensionKind.resolve(scope) === ExtensionKind.PLUGIN) {
          return scopePluginKey(key);
        }
        if (ExtensionKind.resolve(scope) === ExtensionKind.THEME) {
          return scopeThemeKey(key);
        }
        return String(key || '').trim();
      };

      return {
        translate: (
          key: string,
          params?: Record<string, any>,
          locale?: string,
          scope?: ExtensionKind | null,
        ) => {
          if (!hasCapability('i18n')) handleViolation('i18n');
          return manager.i18n.translate(resolveScopedKey(key, scope), params, normalizeLocale(locale));
        },
        translateOrFallback: (
          key: string,
          fallback: string,
          params?: Record<string, any>,
          locale?: string,
          scope?: ExtensionKind | null,
        ) => {
          if (!hasCapability('i18n')) handleViolation('i18n');
          return manager.i18n.translateOrFallback(
            resolveScopedKey(key, scope),
            fallback,
            params,
            normalizeLocale(locale),
          );
        },
        t: (key: string, params?: Record<string, any>, locale?: string) => {
          if (!hasCapability('i18n')) handleViolation('i18n');
          return manager.i18n.translate(scopePluginKey(key), params, normalizeLocale(locale));
        },
        /** The configured default locale (admin Settings → Localization `default_locale`) of the SITE this
         *  work is done for, else the platform's. Use for documents and messages a site issues — invoices,
         *  agreements, emails — instead of the viewer's request locale or a hardcoded literal. It used to
         *  answer the platform's locale only, so a Bulgarian site on an English platform issued English
         *  invoices. */
        defaultLocale: (): string => RequestContextUtils.getSiteLocale() || manager.i18n.getDefaultLocale(),
        siteClock: () => SiteClockAccess.read(RequestContextUtils.getTenantId()),
        registerTranslations: (localeOrDirectory: string = 'i18n', translations?: Record<string, any>) => {
          if (!hasCapability('i18n')) handleViolation('i18n');
          if (translations === undefined) {
            registerTranslationsFromDirectory(localeOrDirectory);
            return;
          }

          manager.i18n.registerTranslations(
            localeOrDirectory,
            plugin.manifest.slug,
            translations as ITranslationMap,
          );
        }
      };

  }
}

import { TranslationMap, LoadedPlugin } from '../../types';
import type { PluginManagerInterface } from './utils.interfaces';
import { ContextSecurityProxy } from './utils';


export class I18nContextProxy {
  static createI18nProxy(
  plugin: LoadedPlugin,
  manager: PluginManagerInterface,
  security: ReturnType<typeof ContextSecurityProxy.createSecurityHelpers>
) {
      const { hasCapability, handleViolation } = security;

      return {
        translate: (key: string, params: any, locale: any) => {
          if (!hasCapability('i18n')) handleViolation('i18n');
          return manager.i18n.translate(key, params, locale);
        },
        t: (key: string, params?: Record<string, any>) => {
          if (!hasCapability('i18n')) handleViolation('i18n');
          return manager.i18n.translate(`${plugin.manifest.slug}.${key}`, params);
        },
        registerTranslations: (locale: string, translations: any) => {
          if (!hasCapability('i18n')) handleViolation('i18n');
          manager.i18n.registerTranslations(locale, plugin.manifest.slug, translations as TranslationMap);
        }
      };

  }
}
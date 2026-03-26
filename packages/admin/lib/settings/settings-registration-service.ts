import { ContextBridge, ContextHooks } from '@fromcode119/react';
import { SettingsFallbackWarningService } from './settings-fallback-warning-service';

export class SettingsRegistrationService {
  static useRegistration(scope: string, pageLabel: string, includeCollectionsFallback = false) {
    let registerSettings = ContextBridge.registerSettings.bind(ContextBridge);
    let collections: any[] = [];

    try {
      const plugins = ContextHooks.usePlugins();
      if (typeof plugins?.registerSettings === 'function') {
        registerSettings = plugins.registerSettings.bind(plugins);
      } else {
        SettingsRegistrationService.warnFallback(scope, pageLabel, includeCollectionsFallback);
      }

      if (Array.isArray(plugins?.collections)) {
        collections = plugins.collections;
      }
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes('usePlugins must be used within a PluginsProvider')
      ) {
        SettingsRegistrationService.warnFallback(scope, pageLabel, includeCollectionsFallback);
      } else {
        throw error;
      }
    }

    return { collections, registerSettings } as const;
  }

  private static warnFallback(scope: string, pageLabel: string, includeCollectionsFallback: boolean): void {
    const fallbackTarget = includeCollectionsFallback
      ? 'ContextBridge.registerSettings and empty collections'
      : 'ContextBridge.registerSettings';

    SettingsFallbackWarningService.warnOnce(
      scope,
      `[${pageLabel}] PluginsProvider is unavailable. Falling back to ${fallbackTarget}.`,
    );
  }
}

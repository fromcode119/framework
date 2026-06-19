import React from 'react';
import type { PluginContextValue } from '../context.interfaces';

export class ContextProviderValueHooks {
  static useContextValue(s: Record<string, any>): PluginContextValue {
    return React.useMemo<PluginContextValue>(() => ({
      slots: s.slots,
      overrides: s.overrides,
      themeVariables: s.themeVariables,
      themeLayouts: s.themeLayouts,
      themeStyleVariants: s.themeStyleVariants,
      activeTheme: s.activeTheme,
      menuItems: s.menuItems,
      secondaryPanel: s.secondaryPanel,
      collections: s.collections,
      fieldComponents: s.fieldComponents,
      plugins: s.plugins,
      settings: s.settings,
      pluginState: s.pluginState,
      translations: s.effectiveTranslations,
      locale: s.locale,
      refreshVersion: s.refreshVersion,
      isReady: s.isReady,
      triggerRefresh: s.triggerRefresh,
      setLocale: s.setLocale,
      t: s.t,
      emit: s.emit,
      on: s.on,
      registerPluginApi: s.registerPluginApi,
      getPluginApi: s.getPluginApi,
      hasPluginApi: s.hasPluginApi,
      setPluginState: s.setPluginState,
      registerContentTransformer: s.registerContentTransformer,
      registerSlotComponent: s.registerSlotComponent,
      registerFieldComponent: s.registerFieldComponent,
      registerOverride: s.registerOverride,
      registerMenuItem: s.registerMenuItem,
      replaceMenuItems: s.replaceMenuItems,
      registerCollection: s.registerCollection,
      replaceCollections: s.replaceCollections,
      registerPlugins: s.registerPlugins,
      registerTheme: s.registerTheme,
      registerSettings: s.registerSettings,
      loadConfig: s.loadConfig,
      getFrontendMetadata: s.getFrontendMetadata,
      resolveContent: s.resolveContent,
      api: s.api,
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }), [s.activeTheme, s.api, s.collections, s.emit, s.fieldComponents, s.getFrontendMetadata, s.getPluginApi, s.hasPluginApi, s.isReady, s.loadConfig, s.locale, s.menuItems, s.on, s.overrides, s.pluginState, s.plugins, s.refreshVersion, s.registerCollection, s.registerContentTransformer, s.registerFieldComponent, s.registerMenuItem, s.registerOverride, s.registerPluginApi, s.registerPlugins, s.registerSettings, s.registerSlotComponent, s.registerTheme, s.replaceCollections, s.replaceMenuItems, s.resolveContent, s.secondaryPanel, s.settings, s.slots, s.t, s.themeLayouts, s.themeStyleVariants, s.themeVariables, s.effectiveTranslations, s.triggerRefresh]);
  }
}

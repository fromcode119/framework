import React from 'react';
import { RenderableContentTransformerRegistry } from '../renderable-content-transformer-registry';
import type { CollectionMetadata, MenuItem, SlotComponent } from '../context.interfaces';
import { ContextProviderStateService } from './context-provider-state-service';
import { FrontendI18nService } from './frontend-i18n-service';
import { ContextProviderSlotRegistrationHooks } from './context-provider-slot-registration-hooks';

export class ContextProviderRegistrationHooks {
  static useRegistrationRuntime(args: {
    events: Map<string, Set<(data: any) => void>>;
    pluginAPIs: Record<string, any>;
    setCollections: React.Dispatch<React.SetStateAction<CollectionMetadata[]>>;
    setFieldComponents: React.Dispatch<React.SetStateAction<Record<string, any>>>;
    setMenuItems: React.Dispatch<React.SetStateAction<MenuItem[]>>;
    setOverrides: React.Dispatch<React.SetStateAction<Record<string, SlotComponent>>>;
    setPluginStateInternal: React.Dispatch<React.SetStateAction<Record<string, Record<string, any>>>>;
    setPlugins: React.Dispatch<React.SetStateAction<any[]>>;
    setRefreshVersion: React.Dispatch<React.SetStateAction<number>>;
    setSettings: React.Dispatch<React.SetStateAction<Record<string, any>>>;
    setRegisteredTranslations: React.Dispatch<React.SetStateAction<Record<string, Record<string, any>>>>;
    setSlots: React.Dispatch<React.SetStateAction<Record<string, SlotComponent[]>>>;
    setThemeLayouts: React.Dispatch<React.SetStateAction<Record<string, any>>>;
    setThemeStyleVariants: React.Dispatch<React.SetStateAction<Record<string, any>>>;
    setThemeVariables: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  }) {
    const {
      events,
      pluginAPIs,
      setCollections,
      setFieldComponents,
      setMenuItems,
      setOverrides,
      setPluginStateInternal,
      setPlugins,
      setRefreshVersion,
      setSettings,
      setRegisteredTranslations,
      setSlots,
      setThemeLayouts,
      setThemeStyleVariants,
      setThemeVariables,
    } = args;

    const registerPluginApi = React.useCallback((namespace: string, slug: string, api: any) => {
      pluginAPIs[ContextProviderStateService.getPluginApiRegistryKey(namespace, slug)] = api;
    }, [pluginAPIs]);

    const getPluginApi = React.useCallback((namespace: string, slug: string) => {
      return pluginAPIs[ContextProviderStateService.getPluginApiRegistryKey(namespace, slug)];
    }, [pluginAPIs]);

    const hasPluginApi = React.useCallback((namespace: string, slug: string) => {
      return getPluginApi(namespace, slug) !== undefined;
    }, [getPluginApi]);

    const setPluginState = React.useCallback((pluginSlug: string, key: string, value: any) => {
      setPluginStateInternal((prev) => ({
        ...prev,
        [pluginSlug]: {
          ...(prev[pluginSlug] || {}),
          [key]: value,
        },
      }));
    }, [setPluginStateInternal]);

    const registerContentTransformer = React.useCallback((
      name: string,
      transform: (content: unknown, currentContent: unknown) => unknown,
      priority?: number,
    ) => {
      const isNew = !RenderableContentTransformerRegistry.has(name);
      RenderableContentTransformerRegistry.register(name, transform, priority);
      if (isNew) {
        setRefreshVersion((value) => value + 1);
      }
    }, [setRefreshVersion]);

    const emit = React.useCallback((event: string, data: any) => {
      const handlers = events.get(event);
      if (handlers) {
        handlers.forEach((handler) => handler(data));
      }
    }, [events]);

    const on = React.useCallback((event: string, handler: (data: any) => void) => {
      if (!events.has(event)) {
        events.set(event, new Set());
      }

      events.get(event)!.add(handler);
      return () => {
        events.get(event)?.delete(handler);
      };
    }, [events]);

    // Accepts a per-locale map — `registerTranslations({ en: {...}, bg: {...} })` — stored per locale
    // so `t()` resolves the active language. A flat dict still works (legacy: applies to all locales).
    const registerTranslations = React.useCallback((newTranslations: Record<string, any>) => {
      setRegisteredTranslations((prev) => FrontendI18nService.foldRegistration(prev, newTranslations));
    }, [setRegisteredTranslations]);

    const slotRegistration = ContextProviderSlotRegistrationHooks.useSlotRegistration({
      setCollections,
      setFieldComponents,
      setMenuItems,
      setOverrides,
      setPlugins,
      setSettings,
      setSlots,
      setThemeLayouts,
      setThemeStyleVariants,
      setThemeVariables,
    });

    return {
      emit,
      getPluginApi,
      hasPluginApi,
      on,
      registerCollection: slotRegistration.registerCollection,
      registerContentTransformer,
      registerFieldComponent: slotRegistration.registerFieldComponent,
      registerMenuItem: slotRegistration.registerMenuItem,
      registerOverride: slotRegistration.registerOverride,
      registerPluginApi,
      registerPlugins: slotRegistration.registerPlugins,
      registerSettings: slotRegistration.registerSettings,
      registerTranslations,
      registerSlotComponent: slotRegistration.registerSlotComponent,
      registerTheme: slotRegistration.registerTheme,
      replaceCollections: slotRegistration.replaceCollections,
      replaceMenuItems: slotRegistration.replaceMenuItems,
      setPluginState,
    };
  }
}

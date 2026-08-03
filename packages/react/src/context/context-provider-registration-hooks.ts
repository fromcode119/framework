import React from 'react';
import { RenderableContentTransformerRegistry } from '@react/renderable-content-transformer-registry';
import type { ICollectionMetadata } from '@react/interfaces/collection-metadata.interface';
import type { IMenuItem } from '@react/interfaces/menu-item.interface';
import type { ISlotComponent } from '@react/interfaces/slot-component.interface';
import { FrontendI18nService } from '@react/context/frontend-i18n-service';
import type { PluginApiRegistryStore } from '@react/context/plugin-api-registry-store';
import { ContextProviderSlotRegistrationHooks } from '@react/context/context-provider-slot-registration-hooks';

export class ContextProviderRegistrationHooks {
  static useRegistrationRuntime(args: {
    events: Map<string, Set<(data: any) => void>>;
    pluginApiStore: PluginApiRegistryStore;
    setCollections: React.Dispatch<React.SetStateAction<ICollectionMetadata[]>>;
    setFieldComponents: React.Dispatch<React.SetStateAction<Record<string, any>>>;
    setMenuItems: React.Dispatch<React.SetStateAction<IMenuItem[]>>;
    setOverrides: React.Dispatch<React.SetStateAction<Record<string, ISlotComponent>>>;
    setPluginStateInternal: React.Dispatch<React.SetStateAction<Record<string, Record<string, any>>>>;
    setPlugins: React.Dispatch<React.SetStateAction<any[]>>;
    setRefreshVersion: React.Dispatch<React.SetStateAction<number>>;
    setSettings: React.Dispatch<React.SetStateAction<Record<string, any>>>;
    setRegisteredTranslations: React.Dispatch<React.SetStateAction<Record<string, Record<string, any>>>>;
    setSlots: React.Dispatch<React.SetStateAction<Record<string, ISlotComponent[]>>>;
    setThemeLayouts: React.Dispatch<React.SetStateAction<Record<string, any>>>;
    setThemeStyleVariants: React.Dispatch<React.SetStateAction<Record<string, any>>>;
    setThemeVariables: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  }) {
    const {
      events,
      pluginApiStore,
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

    // Delegates to the subscribable store: registrations coalesce into ONE post-commit
    // notification per batch, and `usePluginsNamespace` consumers subscribe via
    // `useSyncExternalStore` instead of relying on unrelated provider re-renders.
    const registerPluginApi = React.useCallback((namespace: string, slug: string, api: any) => {
      pluginApiStore.register(namespace, slug, api);
    }, [pluginApiStore]);

    const getPluginApi = React.useCallback((namespace: string, slug: string) => {
      return pluginApiStore.get(namespace, slug);
    }, [pluginApiStore]);

    const hasPluginApi = React.useCallback((namespace: string, slug: string) => {
      return pluginApiStore.has(namespace, slug);
    }, [pluginApiStore]);

    // Render-phase variant (see PluginApiRegistryStore.registerFromRender) used by
    // usePluginApiRegistration — no subscriber notification needed for registrations
    // committed with the same render pass.
    const registerPluginApiFromRender = React.useCallback((namespace: string, slug: string, api: any) => {
      pluginApiStore.registerFromRender(namespace, slug, api);
    }, [pluginApiStore]);

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
      registerPluginApiFromRender,
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

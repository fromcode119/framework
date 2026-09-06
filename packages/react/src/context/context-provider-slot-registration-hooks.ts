import React from 'react';
import type { ICollectionMetadata } from '@react/interfaces/collection-metadata.interface';
import type { IMenuItem } from '@react/interfaces/menu-item.interface';
import type { ISlotComponent } from '@react/interfaces/slot-component.interface';
import { RegistrationStateReducers } from '@react/context/registration-state-reducers';

/**
 * The live registration callbacks. Each one normalises its payload and folds it into provider state
 * through {@link RegistrationStateReducers} — the SAME reducers `PreBootRegistrationSeed` uses to fold
 * registrations that were queued before the provider existed, so a seeded first render and a live replay
 * of the same calls produce identical state.
 */
export class ContextProviderSlotRegistrationHooks {
  static useSlotRegistration(args: {
    setCollections: React.Dispatch<React.SetStateAction<ICollectionMetadata[]>>;
    setFieldComponents: React.Dispatch<React.SetStateAction<Record<string, any>>>;
    setMenuItems: React.Dispatch<React.SetStateAction<IMenuItem[]>>;
    setOverrides: React.Dispatch<React.SetStateAction<Record<string, ISlotComponent>>>;
    setPlugins: React.Dispatch<React.SetStateAction<any[]>>;
    setSettings: React.Dispatch<React.SetStateAction<Record<string, any>>>;
    setSlots: React.Dispatch<React.SetStateAction<Record<string, ISlotComponent[]>>>;
    setThemeLayouts: React.Dispatch<React.SetStateAction<Record<string, any>>>;
    setThemeStyleVariants: React.Dispatch<React.SetStateAction<Record<string, any>>>;
    setThemeVariables: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  }) {
    const {
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
    } = args;

    const registerSlotComponent = React.useCallback((slotName: string, component: any, pluginSlug?: string, priority?: number) => {
      const componentObj = RegistrationStateReducers.normalizeSlotComponent(slotName, component, pluginSlug, priority);
      if (!componentObj) return;
      setSlots((prev) => RegistrationStateReducers.foldSlot(prev, slotName, componentObj));
    }, [setSlots]);

    const registerFieldComponent = React.useCallback((name: string, component: any) => {
      if (!component) {
        console.warn(`[Fromcode] Attempted to register undefined field component "${name}". Ignored.`);
        return;
      }

      let actualComponent = component;
      if (component && !component.$$typeof && typeof component === 'object' && component.default) {
        actualComponent = component.default;
      }

      if (actualComponent && typeof actualComponent === 'object' && !actualComponent.$$typeof) {
        actualComponent =
          actualComponent.component ||
          actualComponent.Component ||
          actualComponent.render ||
          actualComponent.default ||
          actualComponent;
      }

      if (!actualComponent) {
        console.warn(`[Fromcode] Field component "${name}" resolved to undefined.`);
        return;
      }

      const canRenderComponent =
        Boolean(actualComponent) &&
        (typeof actualComponent === 'function' || typeof actualComponent === 'string');
      if (!canRenderComponent) {
        console.warn(`[Fromcode] Field component "${name}" resolved to non-renderable value. Ignored.`);
        return;
      }

      setFieldComponents((prev) => {
        if (prev[name] === actualComponent) {
          return prev;
        }

        return { ...prev, [name]: actualComponent };
      });
    }, [setFieldComponents]);

    const registerOverride = React.useCallback((name: string, component: any, pluginSlug?: string, priority?: number, loader?: ISlotComponent['loader']) => {
      const componentObj = RegistrationStateReducers.normalizeOverride(component, pluginSlug, priority, loader);
      if (!componentObj) return;
      setOverrides((prev) => RegistrationStateReducers.foldOverride(prev, name, componentObj));
    }, [setOverrides]);

    const registerMenuItem = React.useCallback((item: IMenuItem) => {
      setMenuItems((prev) => {
        if (prev.some((menuItem) => menuItem.pluginSlug === item.pluginSlug && menuItem.path === item.path)) {
          return prev;
        }

        return [...prev, item].sort((a, b) => (a.priority || 0) - (b.priority || 0));
      });
    }, [setMenuItems]);

    const replaceMenuItems = React.useCallback((items: IMenuItem[]) => {
      setMenuItems(
        (Array.isArray(items) ? items : [])
          .slice()
          .sort((a, b) => (a.priority || 0) - (b.priority || 0)),
      );
    }, [setMenuItems]);

    const registerCollection = React.useCallback((collection: ICollectionMetadata) => {
      setCollections((prev) => {
        if (prev.some((entry) => entry.slug === collection.slug)) {
          return prev;
        }

        return [...prev, collection];
      });
    }, [setCollections]);

    const replaceCollections = React.useCallback((items: ICollectionMetadata[]) => {
      setCollections(Array.isArray(items) ? items : []);
    }, [setCollections]);

    const registerPlugins = React.useCallback((newPlugins: any[]) => {
      setPlugins(newPlugins);
    }, [setPlugins]);

    const registerSettings = React.useCallback((newSettings: Record<string, any>) => {
      setSettings((prev) => ({ ...prev, ...newSettings }));
    }, [setSettings]);

    const registerTheme = React.useCallback((slug: string, config: any) => {
      if (config?.variables) {
        setThemeVariables((prev) => RegistrationStateReducers.foldThemeVariables(prev, config));
      }

      if (config?.layouts && !Array.isArray(config.layouts)) {
        setThemeLayouts((prev) => RegistrationStateReducers.foldThemeLayouts(prev, config));
      }

      if (config?.styleVariants && !Array.isArray(config.styleVariants)) {
        setThemeStyleVariants((prev) => RegistrationStateReducers.foldThemeStyleVariants(prev, config));
      }

      for (const [name, component, owner, priority] of RegistrationStateReducers.themeOverrideRegistrations(slug, config)) {
        registerOverride(name, component, owner, priority);
      }
    }, [registerOverride, setThemeLayouts, setThemeStyleVariants, setThemeVariables]);

    return {
      registerCollection,
      registerFieldComponent,
      registerMenuItem,
      registerOverride,
      registerPlugins,
      registerSettings,
      registerSlotComponent,
      registerTheme,
      replaceCollections,
      replaceMenuItems,
    };
  }
}

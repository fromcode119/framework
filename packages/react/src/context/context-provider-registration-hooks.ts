import React from 'react';
import { RenderableContentTransformerRegistry } from '../renderable-content-transformer-registry';
import type { CollectionMetadata, MenuItem, SlotComponent } from '../context.interfaces';
import { ContextProviderStateService } from './context-provider-state-service';

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
    setSlots: React.Dispatch<React.SetStateAction<Record<string, SlotComponent[]>>>;
    setThemeLayouts: React.Dispatch<React.SetStateAction<Record<string, any>>>;
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
      setSlots,
      setThemeLayouts,
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

    const registerAPI = React.useCallback((slug: string, api: any) => {
      pluginAPIs[slug] = api;
      registerPluginApi('org.fromcode', slug, api);
    }, [pluginAPIs, registerPluginApi]);

    const getAPI = React.useCallback((slug: string) => {
      return getPluginApi('org.fromcode', slug) ?? pluginAPIs[slug];
    }, [getPluginApi, pluginAPIs]);

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

    const registerSlotComponent = React.useCallback((slotName: string, component: any, pluginSlug?: string, priority?: number) => {
      if (!component) {
        console.warn(`[Fromcode] Attempted to register undefined component for slot "${slotName}" from plugin "${pluginSlug || 'unknown'}". Ignored.`);
        return;
      }

      let actualComponent = component;
      if (component && !component.$$typeof && typeof component === 'object' && component.default) {
        actualComponent = component.default;
      }

      if (!actualComponent) {
        console.warn(`[Fromcode] Component for slot "${slotName}" resolved to undefined. Plugin: ${pluginSlug || 'unknown'}`);
        return;
      }

      let componentObj: SlotComponent;
      if (actualComponent && typeof actualComponent === 'object' && (actualComponent as any).component) {
        componentObj = {
          ...(actualComponent as any),
          pluginSlug: (actualComponent as any).pluginSlug || pluginSlug || 'unknown',
          priority: typeof (actualComponent as any).priority === 'number'
            ? (actualComponent as any).priority
            : (priority || 0),
        } as SlotComponent;
      } else {
        componentObj = {
          component: actualComponent,
          pluginSlug: pluginSlug || 'unknown',
          priority: priority || 0,
        };
      }

      if (!componentObj || !componentObj.component) {
        console.warn(`[Fromcode] Invalid component object for slot "${slotName}" from plugin "${pluginSlug || 'unknown'}".`);
        return;
      }

      setSlots((prev) => {
        const existing = prev[slotName] || [];
        const incomingSignature = ContextProviderRegistrationHooks.getSlotComponentSignature(componentObj);
        const existingIndex = existing.findIndex((item) => {
          if (item.pluginSlug !== componentObj.pluginSlug) {
            return false;
          }

          if (item.component === componentObj.component) {
            return true;
          }

          return ContextProviderRegistrationHooks.getSlotComponentSignature(item) === incomingSignature;
        });

        if (existingIndex >= 0) {
          const current = existing[existingIndex];
          if (current.component === componentObj.component && current.priority === componentObj.priority) {
            return prev;
          }

          const next = [...existing];
          next[existingIndex] = componentObj;
          return {
            ...prev,
            [slotName]: next.sort((a, b) => a.priority - b.priority),
          };
        }

        return {
          ...prev,
          [slotName]: [...existing, componentObj].sort((a, b) => a.priority - b.priority),
        };
      });
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

    const registerOverride = React.useCallback((name: string, component: any, pluginSlug?: string, priority?: number) => {
      if (!component) {
        return;
      }

      let actualComponent = component;
      if (component && !component.$$typeof && typeof component === 'object' && component.default) {
        actualComponent = component.default;
      }

      const componentObj: SlotComponent = typeof actualComponent === 'function' || (actualComponent && (actualComponent as any).$$typeof)
        ? { component: actualComponent, pluginSlug: pluginSlug || 'unknown', priority: priority || 0 }
        : actualComponent;

      setOverrides((prev) => {
        const existing = prev[name];
        if (existing && existing.priority >= componentObj.priority) {
          return prev;
        }

        return { ...prev, [name]: componentObj };
      });
    }, [setOverrides]);

    const registerMenuItem = React.useCallback((item: MenuItem) => {
      setMenuItems((prev) => {
        if (prev.some((menuItem) => menuItem.pluginSlug === item.pluginSlug && menuItem.path === item.path)) {
          return prev;
        }

        return [...prev, item].sort((a, b) => (a.priority || 0) - (b.priority || 0));
      });
    }, [setMenuItems]);

    const replaceMenuItems = React.useCallback((items: MenuItem[]) => {
      setMenuItems(
        (Array.isArray(items) ? items : [])
          .slice()
          .sort((a, b) => (a.priority || 0) - (b.priority || 0)),
      );
    }, [setMenuItems]);

    const registerCollection = React.useCallback((collection: CollectionMetadata) => {
      setCollections((prev) => {
        if (prev.some((entry) => entry.slug === collection.slug)) {
          return prev;
        }

        return [...prev, collection];
      });
    }, [setCollections]);

    const replaceCollections = React.useCallback((items: CollectionMetadata[]) => {
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
        setThemeVariables((prev) => ({ ...prev, ...config.variables }));
      }

      if (config?.layouts && !Array.isArray(config.layouts)) {
        setThemeLayouts((prev) => ({ ...prev, ...config.layouts }));
      }

      if (config?.overrides) {
        if (Array.isArray(config.overrides)) {
          config.overrides.forEach((override: any) => {
            if (override.name && override.component) {
              registerOverride(override.name, override.component, slug, override.priority || 10);
            }
          });
          return;
        }

        Object.entries(config.overrides).forEach(([name, component]) => {
          registerOverride(name, component, slug, 10);
        });
      }
    }, [registerOverride, setThemeLayouts, setThemeVariables]);

    return {
      emit,
      getAPI,
      getPluginApi,
      hasPluginApi,
      on,
      registerAPI,
      registerCollection,
      registerContentTransformer,
      registerFieldComponent,
      registerMenuItem,
      registerOverride,
      registerPluginApi,
      registerPlugins,
      registerSettings,
      registerSlotComponent,
      registerTheme,
      replaceCollections,
      replaceMenuItems,
      setPluginState,
    };
  }

  private static getSlotComponentSignature(componentObj: any): string {
    const component = componentObj?.component;
    if (!component) {
      return `missing:${componentObj?.pluginSlug || 'unknown'}`;
    }

    if (typeof component === 'string') {
      return `string:${component}`;
    }

    if (typeof component === 'function') {
      return `fn:${component.displayName || component.name || 'anonymous'}`;
    }

    if ((component as any)?.$$typeof && (component as any)?.type) {
      const type = (component as any).type;
      if (typeof type === 'function') {
        return `react-element:${type.displayName || type.name || 'anonymous'}`;
      }

      if (typeof type === 'string') {
        return `react-element:${type}`;
      }
    }

    if (typeof component === 'object') {
      const objectValue = component as any;
      if (objectValue.id) {
        return `object-id:${String(objectValue.id)}`;
      }
      if (objectValue.slug) {
        return `object-slug:${String(objectValue.slug)}`;
      }
      if (objectValue.name) {
        return `object-name:${String(objectValue.name)}`;
      }
      if (objectValue.type && typeof objectValue.type === 'string') {
        return `object-type:${objectValue.type}`;
      }
    }

    return `unknown:${componentObj?.pluginSlug || 'unknown'}`;
  }
}

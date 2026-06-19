import React from 'react';
import type { CollectionMetadata, MenuItem, SlotComponent } from '../context.interfaces';

export class ContextProviderSlotRegistrationHooks {
  static useSlotRegistration(args: {
    setCollections: React.Dispatch<React.SetStateAction<CollectionMetadata[]>>;
    setFieldComponents: React.Dispatch<React.SetStateAction<Record<string, any>>>;
    setMenuItems: React.Dispatch<React.SetStateAction<MenuItem[]>>;
    setOverrides: React.Dispatch<React.SetStateAction<Record<string, SlotComponent>>>;
    setPlugins: React.Dispatch<React.SetStateAction<any[]>>;
    setSettings: React.Dispatch<React.SetStateAction<Record<string, any>>>;
    setSlots: React.Dispatch<React.SetStateAction<Record<string, SlotComponent[]>>>;
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
        const incomingSignature = ContextProviderSlotRegistrationHooks.getSlotComponentSignature(componentObj);
        const existingIndex = existing.findIndex((item) => {
          if (item.pluginSlug !== componentObj.pluginSlug) {
            return false;
          }

          if (item.component === componentObj.component) {
            return true;
          }

          return ContextProviderSlotRegistrationHooks.getSlotComponentSignature(item) === incomingSignature;
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

      if (config?.styleVariants && !Array.isArray(config.styleVariants)) {
        setThemeStyleVariants((prev) => ({ ...prev, ...config.styleVariants }));
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

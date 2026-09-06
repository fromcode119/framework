import type { ISlotComponent } from '@react/interfaces/slot-component.interface';

/**
 * The PURE state transitions behind `registerSlotComponent` / `registerOverride` / `registerTheme`.
 *
 * Two callers fold registrations into provider state: the live hooks (`ContextProviderSlotRegistrationHooks`,
 * through `setState(prev => …)`) and the pre-boot seed (`PreBootRegistrationSeed`, which folds the queued
 * calls a theme or plugin bundle made BEFORE the provider existed into the provider's INITIAL state). Both
 * must produce the same state for the same calls, or the first hydration render disagrees with a render
 * after the same registrations replayed live. One reducer, two callers, is what makes that a fact rather
 * than a hope.
 *
 * A registration payload comes from a plugin bundle at runtime, so it is UNTRUSTED input rather than a
 * framework contract: it may be a component, an ES-module namespace wrapping one, a descriptor object, or
 * (after a bad build) nothing. The value checks below discriminate that payload; they are not defensive
 * guards against a guaranteed contract.
 */
export class RegistrationStateReducers {
  /** Normalise a `registerSlotComponent` payload; `null` when there is nothing registerable in it. */
  static normalizeSlotComponent(slotName: string, component: any, pluginSlug?: string, priority?: number): ISlotComponent | null {
    if (!component) {
      console.warn(`[Fromcode] Attempted to register undefined component for slot "${slotName}" from plugin "${pluginSlug || 'unknown'}". Ignored.`);
      return null;
    }

    let actualComponent = component;
    if (component && !component.$$typeof && typeof component === 'object' && component.default) {
      actualComponent = component.default;
    }

    if (!actualComponent) {
      console.warn(`[Fromcode] Component for slot "${slotName}" resolved to undefined. Plugin: ${pluginSlug || 'unknown'}`);
      return null;
    }

    let componentObj: ISlotComponent;
    if (actualComponent && typeof actualComponent === 'object' && (actualComponent as any).component) {
      componentObj = {
        ...(actualComponent as any),
        pluginSlug: (actualComponent as any).pluginSlug || pluginSlug || 'unknown',
        priority: typeof (actualComponent as any).priority === 'number'
          ? (actualComponent as any).priority
          : (priority || 0),
      } as ISlotComponent;
    } else {
      componentObj = {
        component: actualComponent,
        pluginSlug: pluginSlug || 'unknown',
        priority: priority || 0,
      };
    }

    if (!componentObj || !componentObj.component) {
      console.warn(`[Fromcode] Invalid component object for slot "${slotName}" from plugin "${pluginSlug || 'unknown'}".`);
      return null;
    }
    return componentObj;
  }

  /** Fold one normalised slot component into the slots map. Returns `prev` when nothing changes. */
  static foldSlot(
    prev: Record<string, ISlotComponent[]>,
    slotName: string,
    componentObj: ISlotComponent,
  ): Record<string, ISlotComponent[]> {
    const existing = prev[slotName] || [];
    const incomingSignature = RegistrationStateReducers.slotComponentSignature(componentObj);
    const existingIndex = existing.findIndex((item) => {
      if (item.pluginSlug !== componentObj.pluginSlug) return false;
      if (item.component === componentObj.component) return true;
      return RegistrationStateReducers.slotComponentSignature(item) === incomingSignature;
    });

    if (existingIndex >= 0) {
      const current = existing[existingIndex];
      if (current.component === componentObj.component && current.priority === componentObj.priority) {
        return prev;
      }
      const next = [...existing];
      next[existingIndex] = componentObj;
      return { ...prev, [slotName]: next.sort((a, b) => a.priority - b.priority) };
    }

    return { ...prev, [slotName]: [...existing, componentObj].sort((a, b) => a.priority - b.priority) };
  }

  /** Normalise a `registerOverride` payload; `null` when empty. */
  static normalizeOverride(component: any, pluginSlug?: string, priority?: number, loader?: ISlotComponent['loader']): ISlotComponent | null {
    if (!component) return null;

    let actualComponent = component;
    if (component && !component.$$typeof && typeof component === 'object' && component.default) {
      actualComponent = component.default;
    }

    return typeof actualComponent === 'function' || (actualComponent && (actualComponent as any).$$typeof)
      ? { component: actualComponent, pluginSlug: pluginSlug || 'unknown', priority: priority || 0, ...(loader ? { loader } : {}) }
      : actualComponent;
  }

  /** Fold one override; a registration at a lower-or-equal priority than the current one is ignored. */
  static foldOverride(
    prev: Record<string, ISlotComponent>,
    name: string,
    componentObj: ISlotComponent,
  ): Record<string, ISlotComponent> {
    const existing = prev[name];
    if (existing && existing.priority >= componentObj.priority) return prev;
    return { ...prev, [name]: componentObj };
  }

  /** The override registrations a `registerTheme(slug, config)` call implies, in the order it makes them. */
  static themeOverrideRegistrations(slug: string, config: any): Array<[string, unknown, string, number]> {
    if (!config?.overrides) return [];
    if (Array.isArray(config.overrides)) {
      return config.overrides
        .filter((override: any) => override.name && override.component)
        .map((override: any) => [override.name, override.component, slug, override.priority || 10]);
    }
    return Object.entries(config.overrides).map(([name, component]) => [name, component, slug, 10]);
  }

  /** `registerTheme`'s variables merge — only when the config carries any. */
  static foldThemeVariables(prev: Record<string, string>, config: any): Record<string, string> {
    return config?.variables ? { ...prev, ...config.variables } : prev;
  }

  /** `registerTheme`'s layouts merge — a map, never an array. */
  static foldThemeLayouts(prev: Record<string, any>, config: any): Record<string, any> {
    return config?.layouts && !Array.isArray(config.layouts) ? { ...prev, ...config.layouts } : prev;
  }

  /** `registerTheme`'s style-variant merge — a map, never an array. */
  static foldThemeStyleVariants(prev: Record<string, any>, config: any): Record<string, any> {
    return config?.styleVariants && !Array.isArray(config.styleVariants) ? { ...prev, ...config.styleVariants } : prev;
  }

  private static slotComponentSignature(componentObj: any): string {
    const component = componentObj?.component;
    if (!component) return `missing:${componentObj?.pluginSlug || 'unknown'}`;
    if (typeof component === 'string') return `string:${component}`;
    if (typeof component === 'function') return `fn:${component.displayName || component.name || 'anonymous'}`;

    if ((component as any)?.$$typeof && (component as any)?.type) {
      const type = (component as any).type;
      if (typeof type === 'function') return `react-element:${type.displayName || type.name || 'anonymous'}`;
      if (typeof type === 'string') return `react-element:${type}`;
    }

    if (typeof component === 'object') {
      const objectValue = component as any;
      if (objectValue.id) return `object-id:${String(objectValue.id)}`;
      if (objectValue.slug) return `object-slug:${String(objectValue.slug)}`;
      if (objectValue.name) return `object-name:${String(objectValue.name)}`;
      if (objectValue.type && typeof objectValue.type === 'string') return `object-type:${objectValue.type}`;
    }

    return `unknown:${componentObj?.pluginSlug || 'unknown'}`;
  }
}

import type { ISlotComponent } from '@react/interfaces/slot-component.interface';
import { FrontendI18nService } from '@react/context/frontend-i18n-service';
import { RegistrationStateReducers } from '@react/context/registration-state-reducers';
import { RenderableContentTransformerRegistry } from '@react/renderable-content-transformer-registry';

/**
 * The registration state a page starts with when theme and plugin bundles evaluated BEFORE the provider
 * mounted.
 *
 * Under the islands runtime the boot order is: pre-boot bridge → theme + eager plugin bundles → provider.
 * Every `registerTheme` / `registerSlotComponent` / `registerOverride` / `registerTranslations` a bundle
 * makes at evaluation lands in the pre-boot queue (`window._fromcodeQueue`, written by the queueing
 * bridge). This class folds those items into the slices `PluginsProviderInternal` initialises its state
 * from, through the same reducers the live hooks use — so the first (hydrating) render already sees the
 * theme's layouts and the plugins' slots, and React can adopt the server markup instead of re-rendering.
 *
 * Content transformers are applied straight to their static registry (the provider only bumps a refresh
 * counter for them, and nothing has rendered yet). Everything else in the queue — field components, menu
 * items, collections, settings, plugin state — has no seedable slice and is LEFT in the queue for the live
 * bridge to flush exactly as it does today.
 */
export class PreBootRegistrationSeed {
  static readonly QUEUE_KEY = '_fromcodeQueue';

  readonly slots: Record<string, ISlotComponent[]>;

  readonly overrides: Record<string, ISlotComponent>;

  readonly themeVariables: Record<string, string>;

  readonly themeLayouts: Record<string, any>;

  readonly themeStyleVariants: Record<string, any>;

  readonly registeredTranslations: Record<string, Record<string, any>>;

  readonly themeTranslations: Record<string, Record<string, any>>;

  private constructor(state: {
    slots: Record<string, ISlotComponent[]>;
    overrides: Record<string, ISlotComponent>;
    themeVariables: Record<string, string>;
    themeLayouts: Record<string, any>;
    themeStyleVariants: Record<string, any>;
    registeredTranslations: Record<string, Record<string, any>>;
    themeTranslations: Record<string, Record<string, any>>;
  }) {
    this.slots = state.slots;
    this.overrides = state.overrides;
    this.themeVariables = state.themeVariables;
    this.themeLayouts = state.themeLayouts;
    this.themeStyleVariants = state.themeStyleVariants;
    this.registeredTranslations = state.registeredTranslations;
    this.themeTranslations = state.themeTranslations;
  }

  /** Nothing registered — every slice at the provider's own default. */
  static empty(): PreBootRegistrationSeed {
    return new PreBootRegistrationSeed({
      slots: {}, overrides: {}, themeVariables: {}, themeLayouts: {}, themeStyleVariants: {},
      registeredTranslations: {}, themeTranslations: {},
    });
  }

  /** The same registrations with `themeVariables` replaced — the theme's own `variables` folded under the registered ones. */
  withThemeVariables(themeVariables: Record<string, string>): PreBootRegistrationSeed {
    return new PreBootRegistrationSeed({
      slots: this.slots, overrides: this.overrides, themeVariables, themeLayouts: this.themeLayouts,
      themeStyleVariants: this.themeStyleVariants, registeredTranslations: this.registeredTranslations,
      themeTranslations: this.themeTranslations,
    });
  }

  /**
   * Fold the seedable items of `queue` into a seed. Returns the seed and the RESIDUAL queue — the items
   * that must still be flushed once the live bridge is installed. The `switch` IS the list of seedable
   * types; anything it does not name is residual.
   */
  static fold(queue: ReadonlyArray<{ type: string; args?: unknown[] }>): { seed: PreBootRegistrationSeed; residual: Array<{ type: string; args?: unknown[] }> } {
    let slots: Record<string, ISlotComponent[]> = {};
    let overrides: Record<string, ISlotComponent> = {};
    let themeVariables: Record<string, string> = {};
    let themeLayouts: Record<string, any> = {};
    let themeStyleVariants: Record<string, any> = {};
    let registeredTranslations: Record<string, Record<string, any>> = {};
    let themeTranslations: Record<string, Record<string, any>> = {};
    const residual: Array<{ type: string; args?: unknown[] }> = [];

    const foldOverride = (name: string, component: unknown, pluginSlug?: string, priority?: number, loader?: ISlotComponent['loader']) => {
      const componentObj = RegistrationStateReducers.normalizeOverride(component, pluginSlug, priority, loader);
      if (componentObj) overrides = RegistrationStateReducers.foldOverride(overrides, name, componentObj);
    };

    for (const item of queue) {
      const args = (item.args || []) as any[];
      switch (item.type) {
        case 'slot': {
          const [slotName, component, pluginSlug, priority] = args;
          const componentObj = RegistrationStateReducers.normalizeSlotComponent(slotName, component, pluginSlug, priority);
          if (componentObj) slots = RegistrationStateReducers.foldSlot(slots, slotName, componentObj);
          break;
        }
        case 'override': {
          const [name, component, pluginSlug, priority, loader] = args;
          foldOverride(name, component, pluginSlug, priority, loader);
          break;
        }
        case 'theme': {
          const [slug, config] = args;
          themeVariables = RegistrationStateReducers.foldThemeVariables(themeVariables, config);
          themeLayouts = RegistrationStateReducers.foldThemeLayouts(themeLayouts, config);
          themeStyleVariants = RegistrationStateReducers.foldThemeStyleVariants(themeStyleVariants, config);
          for (const registration of RegistrationStateReducers.themeOverrideRegistrations(slug, config)) foldOverride(...registration);
          break;
        }
        case 'translations': {
          const [payload, layer] = args;
          if (layer === FrontendI18nService.THEME_LAYER) themeTranslations = FrontendI18nService.foldRegistration(themeTranslations, payload);
          else registeredTranslations = FrontendI18nService.foldRegistration(registeredTranslations, payload);
          break;
        }
        case 'contentTransformer': {
          const [name, transform, priority] = args;
          RenderableContentTransformerRegistry.register(name, transform, priority);
          break;
        }
        default:
          residual.push(item);
      }
    }

    return {
      seed: new PreBootRegistrationSeed({ slots, overrides, themeVariables, themeLayouts, themeStyleVariants, registeredTranslations, themeTranslations }),
      residual,
    };
  }

  /**
   * Fold the window's pre-boot queue and write the residual back, so the live bridge's flush replays only
   * what was NOT seeded — never a registration twice.
   */
  static consume(target: Record<string, any>): PreBootRegistrationSeed {
    const queue = target[PreBootRegistrationSeed.QUEUE_KEY];
    if (!Array.isArray(queue) || queue.length === 0) return PreBootRegistrationSeed.empty();
    const { seed, residual } = PreBootRegistrationSeed.fold(queue);
    if (residual.length) target[PreBootRegistrationSeed.QUEUE_KEY] = residual;
    else delete target[PreBootRegistrationSeed.QUEUE_KEY];
    return seed;
  }
}

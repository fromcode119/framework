import { Reactor } from '@fromcode119/reactor';
import { PluginsFacade } from '@fromcode119/core/client';
import { PluginRuntimeContext } from '@react/view/plugin-runtime-context.client';
import type { PluginRuntimeValue } from '@react/plugin-runtime-value';
import type { ITranslationContextValue } from '@react/context/interfaces/translation-context-value.interface';

/**
 * Base class for hook-free plugin UI components. Extends {@link Reactor}, so subclasses get the
 * `@bound` / `@watch` / `@state` OOP ergonomics for free, and reads {@link PluginRuntimeContext}
 * as the class contextType so they access runtime values via `this.runtime` / `this.t` /
 * `this.namespace()` without calling `ContextHooks`. Requires a {@link PluginRuntimeProvider}
 * ancestor (mounted by the admin/theme plugin host).
 */
export abstract class PluginComponent<P = Record<string, unknown>, S = Record<string, unknown>>
  extends Reactor<P, S> {
  static contextType = PluginRuntimeContext.context;
  declare context: PluginRuntimeValue;

  protected get runtime(): PluginRuntimeValue {
    return this.context;
  }

  protected get plugins(): any {
    return this.context?.plugins;
  }

  /** Translation function (falls back to identity when no provider is present). */
  protected get t(): ITranslationContextValue['t'] {
    return this.context?.translation?.t ?? ((key: string) => key);
  }

  protected get globalSettings(): Record<string, any> {
    return this.context?.globalSettings ?? {};
  }

  protected get locale(): string {
    return this.context?.locale ?? 'en';
  }

  protected get api(): any {
    return this.context?.api;
  }

  protected get collections(): any[] {
    return this.context?.collections ?? [];
  }

  /** Cross-plugin namespace facade, e.g. `this.namespace('org.fromcode').finance.listCurrencies()`. */
  protected namespace(namespace: string): any {
    const registry: any = this.context?.plugins;
    if (!registry) return undefined;
    const facade = new PluginsFacade({
      has: (targetNamespace: string, slug: string): boolean => registry.hasPluginApi?.(targetNamespace, slug) ?? false,
      resolve: (targetNamespace: string, slug: string): unknown => registry.getPluginApi?.(targetNamespace, slug),
    });
    return facade.namespace(namespace);
  }
}

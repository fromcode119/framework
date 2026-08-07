import type { ComponentType } from 'react';
import { Reactor } from '@fromcode119/reactor';
// Value import, NOT `import type`: ThemeMode.LIGHT is dereferenced at runtime below.
import { ThemeMode } from '@fromcode119/core/client';
import { AdminRuntimeContext } from '@/components/view/admin-runtime-context.client';
import type { IAdminRuntimeValue } from '@/components/interfaces/admin-runtime-value.interface';
import type { IThemeContextType } from '@/components/interfaces/theme-context-type.interface';
import { AdminAppearanceConstants } from '@/lib/appearance/constants/admin-appearance.constants';
import { AdminComponentRegistry } from '@/lib/appearance/admin-component-registry';
import { AdminPageRegistry } from '@/lib/appearance/admin-page-registry';

/**
 * Base class for hook-free admin components. Extends the reactor {@link Reactor} base so subclasses (admin
 * UI + appearance components) get `@state`/`@bound`/`@watch`/`this.ref()` etc.; reads {@link AdminRuntimeContext}
 * as the class contextType so they access runtime values via `this.runtime` without calling hooks.
 */
export abstract class AdminComponent<P = Record<string, unknown>, S = Record<string, unknown>>
  extends Reactor<P, S> {
  static contextType = AdminRuntimeContext.context;

  /**
   * Truthfully nullable: {@link AdminRuntimeContext} is created with a `null` default, so a
   * component mounted outside {@link AdminRuntimeProvider} gets `null` here — NOT a runtime value.
   * Typing this non-nullable was a lie that hid real null derefs from tsc: `PluginSettingsForm`
   * shipped `this.runtime.plugins.triggerRefresh`, which tsc accepted and which threw on every
   * bare mount, silently swallowed by the caller's own catch.
   */
  declare context: IAdminRuntimeValue | null;

  /**
   * The runtime value, fail-closed. `AdminRuntimeProvider` wraps the whole admin (see ClientLayout),
   * so every mounted component genuinely has one and callers may deref this directly — that contract
   * is now ENFORCED here rather than merely asserted by a type. Reading it without the provider is a
   * wiring bug, and throwing names it at the point of failure instead of surfacing as an opaque
   * `Cannot read properties of null` inside some unrelated catch block.
   *
   * Accessors that must tolerate a missing provider (theme, collections, pathname, …) read
   * `this.context?.` directly and are unaffected.
   */
  protected get runtime(): IAdminRuntimeValue {
    const runtime = this.context;
    if (!runtime) {
      throw new Error(
        `${(this.constructor as { name?: string }).name ?? 'AdminComponent'} read \`this.runtime\` `
        + 'outside AdminRuntimeProvider. Mount it inside the admin provider tree (ClientLayout), or '
        + 'in a test wrap it in <AdminRuntimeContext.context.Provider value={…}>.'
      );
    }
    return runtime;
  }

  /**
   * Presentation-only, so this degrades instead of throwing: a component that somehow renders before
   * the provider still paints, in light mode. LIGHT is not an invented default — it is the same
   * default `ThemeMode.resolve()` already applies for an unrecognised value.
   */
  protected get theme(): IThemeContextType['theme'] {
    return this.context?.theme ?? ThemeMode.LIGHT;
  }

  protected get collections(): any[] {
    return this.context?.collections ?? [];
  }

  /**
   * App Router navigation — replaces `useRouter()` for hook-free classes. Required capability, so it
   * reads the enforced runtime: navigating without a provider is a wiring bug, not a soft state.
   */
  protected get router(): IAdminRuntimeValue['router'] {
    return this.runtime.router;
  }

  /** Current pathname — replaces `usePathname()` for hook-free classes. */
  protected get pathname(): string {
    return this.context?.pathname ?? '';
  }

  /**
   * Current route params from the admin runtime — replaces `useParams()` for hook-free classes.
   *
   * NOT named `params`: Next's App Router passes route params to a page as a `params` PROP (a Promise
   * since Next 15), and 37 page classes declare it as such. A base accessor of the same name made every
   * one of those an illegal override (TS2416/TS2610).
   */
  protected get runtimeParams(): IAdminRuntimeValue['params'] {
    return this.context?.params ?? {};
  }

  /**
   * Auth context — replaces `AuthHooks.useAuth()` for hook-free classes. Required capability, so it
   * reads the enforced runtime: an auth read that silently returned `undefined` outside the provider
   * would fail OPEN at call sites that branch on `this.auth.user`.
   */
  protected get auth(): IAdminRuntimeValue['auth'] {
    return this.runtime.auth;
  }

  /** Active admin appearance id (selection result) — lets classes branch on the chosen appearance. */
  protected get activeAppearanceId(): string {
    return this.context?.activeAppearanceId ?? AdminAppearanceConstants.DEFAULT_APPEARANCE_ID;
  }

  /**
   * Resolve a UI primitive for the active appearance: the appearance's override if present, else
   * the framework default. Returns undefined if the primitive name is unregistered.
   */
  protected component(name: string): ComponentType<any> | undefined {
    return AdminComponentRegistry.shared.resolve(this.activeAppearanceId, name);
  }

  /**
   * Resolve a page body for the active appearance: the appearance's override if present, else the
   * registered default. Returns undefined when neither exists — callers then render their own
   * existing default page.
   *
   * NOT named `page`: several page classes carry a `@state page` pagination counter, and a base method
   * of the same name made those an illegal override (TS2416).
   */
  protected pageBody(key: string): ComponentType<any> | undefined {
    return AdminPageRegistry.shared.resolve(this.activeAppearanceId, key);
  }
}

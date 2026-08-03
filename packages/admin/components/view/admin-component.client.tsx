import type { ComponentType } from 'react';
import { Reactor } from '@fromcode119/reactor';
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
  declare context: IAdminRuntimeValue;

  protected get runtime(): IAdminRuntimeValue {
    return this.context;
  }

  protected get theme(): IThemeContextType['theme'] {
    return this.context?.theme;
  }

  protected get collections(): any[] {
    return this.context?.collections ?? [];
  }

  /** App Router navigation — replaces `useRouter()` for hook-free classes. */
  protected get router(): IAdminRuntimeValue['router'] {
    return this.context?.router;
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

  /** Auth context — replaces `AuthHooks.useAuth()` for hook-free classes. */
  protected get auth(): IAdminRuntimeValue['auth'] {
    return this.context?.auth;
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

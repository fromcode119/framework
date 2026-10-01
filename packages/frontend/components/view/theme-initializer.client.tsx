import { Reactor } from '@fromcode119/react-class-components';
import { SystemConstants } from '@fromcode119/core/client';
import { PluginContextRegistry } from '@fromcode119/react/plugin-context';
import { AccountSlotRegistrar } from '@/components/account/account-slot-registrar';
import { ContextBridge } from '@fromcode119/react/context-bridge';
import { StorefrontNoticeBar } from '@fromcode119/react/storefront-notice/storefront-notice-bar';
import { StorefrontContentContract } from '@/lib/storefront-content-contract';

export class ThemeInitializer extends Reactor {
  /**
   * Registers the account slots exactly once. A static field initialiser runs on CLASS evaluation, i.e.
   * module evaluation — the same timing the module-level `register()` call had, without the statement.
   */
  private static readonly registered = ThemeInitializer.registerSlots();

  // Reads the plugins context DIRECTLY (what ContextHooks.usePlugins does) — this component renders
  // OUTSIDE PluginRuntimeProvider (it's a sibling of it in root-provider), so PluginRuntimeContext is
  // unavailable here; PluginContext (from PluginsProvider) IS. The context value IS the plugins object.
  static contextType = PluginContextRegistry.Context;
  declare context: any;

  private appliedThemeVariables: Record<string, string> | null = null;

  private static registerSlots(): boolean {
    AccountSlotRegistrar.register();
    return true;
  }

  private static noticeBarRegistered = false;

  /**
   * The one-time notice a redirect from an email link carries (`context.ui.noticeUrl`), over every page.
   * Registered at MOUNT, not when this module is evaluated: a slot registration made before the
   * provider's bridge is installed is dropped without a word (`ContextBridge` forwards to nothing), and
   * on the islands storefront the module is evaluated first — the bar never mounted.
   */
  private static registerNoticeBar(): void {
    if (ThemeInitializer.noticeBarRegistered) return;
    ThemeInitializer.noticeBarRegistered = true;
    ContextBridge.registerSlotComponent(StorefrontContentContract.OVERLAY_SLOT, StorefrontNoticeBar, 'framework', 1);
  }

  private get plugins(): any {
    return this.context;
  }

  componentDidMount(): void {
    ThemeInitializer.registerNoticeBar();
    // A provider seeded from the document (islands runtime) is READY at mount and already holds this
    // payload; fetching it again would only re-set identical state. Unseeded (admin, Next storefront)
    // it is never ready at mount, so the load runs exactly as before.
    if (!this.plugins.isReady) this.plugins.loadConfig(SystemConstants.API_PATH.SYSTEM.FRONTEND);
    this.applyThemeVariables();
  }

  componentDidUpdate(): void {
    if (this.plugins?.themeVariables !== this.appliedThemeVariables) {
      this.applyThemeVariables();
    }
  }

  private applyThemeVariables(): void {
    const themeVariables = this.plugins?.themeVariables;
    this.appliedThemeVariables = themeVariables;
    const root = document.documentElement;
    Object.entries(themeVariables || {}).forEach(([key, value]) => {
      root.style.setProperty(`--theme-${key}`, value as string);
    });
  }

  render(): null {
    return null;
  }
}

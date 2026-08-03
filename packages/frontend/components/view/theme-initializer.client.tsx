import { Reactor } from '@fromcode119/reactor';
import { SystemConstants } from '@fromcode119/core/client';
import { PluginContextRegistry } from '@fromcode119/react/plugin-context';
import { AccountSlotRegistrar } from '@/components/account/account-slot-registrar';

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

  private get plugins(): any {
    return this.context;
  }

  componentDidMount(): void {
    this.plugins.loadConfig(SystemConstants.API_PATH.SYSTEM.FRONTEND);
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

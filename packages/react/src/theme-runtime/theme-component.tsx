import { Reactor } from '@fromcode119/react-class-components';
import { ThemeRuntimeContext } from '@react/theme-runtime/theme-runtime-context';
import { NullPluginsFacade } from '@react/theme-runtime/null-plugins-facade';
import type { IThemeRuntimeValue } from '@react/theme-runtime/interfaces/theme-runtime-value.interface';

/**
 * The base of every theme component: reads the runtime from `this.runtime` without calling a hook.
 * Without a provider (the admin's block previews) it falls back to a stub that says nothing.
 */
export abstract class ThemeComponent<P = Record<string, unknown>, S = Record<string, unknown>> extends Reactor<P, S> {
  static contextType = ThemeRuntimeContext.Context.raw;
  declare context: IThemeRuntimeValue;

  private static readonly SAFE_RUNTIME: IThemeRuntimeValue = {
    locale: 'en',
    settings: null,
    globalSettings: {},
    plugins: null,
    fromcode: NullPluginsFacade.create(),
    t: (key: string) => key,
  };

  protected get runtime(): IThemeRuntimeValue {
    return this.context ?? ThemeComponent.SAFE_RUNTIME;
  }

  /** The operator's theme settings (`theme.json` variables, as saved under Themes), or an empty record. */
  protected get themeVariables(): Record<string, unknown> {
    const variables = this.runtime.plugins?.activeTheme?.variables;
    return variables && typeof variables === 'object' ? variables : {};
  }

  /** A translation, or the fallback when the key has none; never the bare key on screen. */
  protected t(key: string, fallback = '', vars?: Record<string, unknown>): string {
    const translated = this.runtime.t(key, vars as never);
    return translated && translated !== key ? translated : fallback;
  }
}

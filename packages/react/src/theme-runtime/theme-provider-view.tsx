import type { ReactNode } from 'react';
import { Reactor, prop } from '@fromcode119/react-class-components';
import { ThemeRuntimeContext } from '@react/theme-runtime/theme-runtime-context';
import type { IThemeRuntimeValue } from '@react/theme-runtime/interfaces/theme-runtime-value.interface';
import type { IThemeProviderValues } from '@react/theme-runtime/interfaces/theme-provider-values.interface';

/** Publishes the theme runtime, rebuilt only when one of its inputs changes so consumers do not re-render for nothing. */
export class ThemeProviderView extends Reactor {
  @prop declare values: IThemeProviderValues;

  @prop declare children: ReactNode;

  private runtimeValue: IThemeRuntimeValue | null = null;

  private runtimeInputs: unknown[] = [];

  private get runtime(): IThemeRuntimeValue {
    const v = this.values;
    // `locale` is an input: without it a language switch would hand back the cached runtime.
    const inputs = [v.settings, v.globalSettings, v.plugins, v.fromcode, v.t, v.locale];
    const unchanged = this.runtimeValue
      && inputs.length === this.runtimeInputs.length
      && inputs.every((input, index) => input === this.runtimeInputs[index]);
    if (unchanged) return this.runtimeValue as IThemeRuntimeValue;

    this.runtimeInputs = inputs;
    this.runtimeValue = {
      settings: v.settings,
      globalSettings: v.globalSettings,
      plugins: v.plugins,
      fromcode: v.fromcode,
      t: v.t,
      locale: v.locale,
    } as IThemeRuntimeValue;
    return this.runtimeValue;
  }

  render(): ReactNode {
    return (
      <ThemeRuntimeContext.Context.raw.Provider value={this.runtime}>
        {this.children}
      </ThemeRuntimeContext.Context.raw.Provider>
    );
  }
}

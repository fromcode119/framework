import type { ReactNode } from 'react';
import { Bridge, prop } from '@fromcode119/react-class-components';
import { ContextHooks } from '@react/context-hooks/context-hooks';
import { ThemeProviderView } from '@react/theme-runtime/theme-provider-view';
import type { IThemeProviderValues } from '@react/theme-runtime/interfaces/theme-provider-values.interface';

/** The theme's one hook boundary: framework hooks are read here and handed to a plain class. */
export class ThemeProvider extends Bridge<IThemeProviderValues> {
  @prop declare children: ReactNode;

  protected read(): IThemeProviderValues {
    const { t, locale } = ContextHooks.useTranslation();
    return {
      locale,
      t,
      plugins: ContextHooks.usePlugins(),
      fromcode: ContextHooks.usePluginsNamespace('org.fromcode'),
      settings: ContextHooks.useSettings(),
      globalSettings: ContextHooks.useGlobalSettings(),
    };
  }

  protected present(values: IThemeProviderValues): ReactNode {
    return <ThemeProviderView values={values}>{this.children}</ThemeProviderView>;
  }
}

/**
 * The runtime plumbing every theme needs: the one hook boundary (ThemeProvider), the component base that
 * reads the runtime without hooks, the editor-session check, and the theme's identity. Generated from a
 * theme that builds and renders, so a new theme starts on the shape the platform runs today.
 */
export class ThemeScaffoldContextFiles {
  /** Path (inside the theme) to file content, for a theme called `slug`. */
  static files(slug: string): Record<string, string> {
    return {
      'src/context/interfaces/theme-provider-values.interface.ts': `/** The hook-derived values ThemeProvider reads once and hands to its view. */
export interface IThemeProviderValues {
  plugins: any;
  fromcode: any;
  settings: any;
  globalSettings: any;
  t: (key: string, ...rest: any[]) => string;
  /** The framework's active locale, from the same translation context as \`t\`. */
  locale: string;
}
`,
      'src/context/interfaces/theme-runtime-value.interface.ts': `/**
 * What theme components need but can only get through React hooks. Read once by ThemeProvider and
 * published through ThemeRuntimeContext, so every other component stays a hook-free class.
 */
export interface IThemeRuntimeValue {
  settings: any;
  globalSettings: Record<string, any>;
  /** \`ContextHooks.usePlugins()\`: carries \`activeTheme.variables\`, the operator's theme settings. */
  plugins: any;
  /** The \`org.fromcode\` plugin namespace (the CMS navigation client lives here). */
  fromcode: any;
  t(key: string, vars?: Record<string, unknown>): string;
  locale: string;
}
`,
      'src/context/theme-runtime-context.tsx': `import { Context } from '@fromcode119/sdk/react';
import type { IThemeRuntimeValue } from '@theme/context/interfaces/theme-runtime-value.interface';

/** The React context that carries the theme runtime to class components. */
export class ThemeRuntimeContext {
  static readonly Context = new Context<IThemeRuntimeValue | null>(null);
}
`,
      'src/context/null-plugins-facade.ts': `/**
 * A safe stand-in for the \`org.fromcode\` namespace where no provider exists (the admin's block previews).
 * Every lookup answers null, so callers render nothing instead of throwing.
 */
export class NullPluginsFacade {
  static create(): any {
    const base = {
      isReady: false,
      get: (_slug: string) => null,
      has: (_slug: string) => false,
      require: (_slug: string) => null,
    };
    return new Proxy(base, {
      get(target, prop, receiver) {
        if (prop in target || typeof prop === 'symbol') return Reflect.get(target, prop, receiver);
        return null;
      },
    });
  }
}
`,
      'src/context/theme-component.tsx': `import { Reactor } from '@fromcode119/sdk/react';
import type { IThemeRuntimeValue } from '@theme/context/interfaces/theme-runtime-value.interface';
import { ThemeRuntimeContext } from '@theme/context/theme-runtime-context';
import { NullPluginsFacade } from '@theme/context/null-plugins-facade';

/**
 * The base of every theme component: reads the runtime from \`this.runtime\` without calling a hook.
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

  /** A translation, or the fallback when the key has none; never the bare key on screen. */
  protected t(key: string, fallback = '', vars?: Record<string, unknown>): string {
    const translated = this.runtime.t(key, vars as never);
    return translated && translated !== key ? translated : fallback;
  }
}
`,
      'src/context/theme-context.tsx': `import type { ReactNode } from 'react';
import { Bridge, ContextHooks, prop } from '@fromcode119/sdk/react';
import { ThemeProviderView } from '@theme/context/theme-provider-view';
import type { IThemeProviderValues } from '@theme/context/interfaces/theme-provider-values.interface';

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
`,
      'src/context/theme-provider-view.tsx': `import type { ReactNode } from 'react';
import { Reactor, prop } from '@fromcode119/sdk/react';
import { ThemeRuntimeContext } from '@theme/context/theme-runtime-context';
import type { IThemeRuntimeValue } from '@theme/context/interfaces/theme-runtime-value.interface';
import type { IThemeProviderValues } from '@theme/context/interfaces/theme-provider-values.interface';

/** Publishes the theme runtime, rebuilt only when one of its inputs changes so consumers do not re-render for nothing. */
export class ThemeProviderView extends Reactor {
  @prop declare values: IThemeProviderValues;

  @prop declare children: ReactNode;

  private runtimeValue: IThemeRuntimeValue | null = null;

  private runtimeInputs: unknown[] = [];

  private get runtime(): IThemeRuntimeValue {
    const v = this.values;
    // \`locale\` is an input: without it a language switch would hand back the cached runtime.
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
`,
      'src/lib/site/theme-editor-session-service.ts': `import { BrowserStateClient } from '@fromcode119/sdk';

/**
 * Whether this page load is a CMS visual-editor session. Only then does LayoutShell route the page
 * through the editor's app-shell slot; for everyone else that swap would remount the page.
 */
export class ThemeEditorSessionService {
  private static readonly browserState = new BrowserStateClient();

  private static readonly EDITOR_PARAMS = ['edit', 'preview', 'cms', 'draft'];

  static isEditorSessionRequest(): boolean {
    return ThemeEditorSessionService.EDITOR_PARAMS.some(
      (name) => ThemeEditorSessionService.browserState.readQueryParamFromWindow(name) !== '',
    );
  }
}
`,
      'src/constants/theme-identity.ts': `/** What this theme is called everywhere it must name itself. One place, so a rename is one edit. */
export class ThemeIdentity {
  static readonly SLUG = '${slug}';
}
`,
    };
  }
}

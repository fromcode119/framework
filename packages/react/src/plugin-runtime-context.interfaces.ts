import type { TranslationContextValue } from './context/translation-context.interfaces';

/**
 * Context-backed values plugin UI components need, read ONCE by {@link PluginRuntimeProvider}
 * and published via PluginRuntimeContext so plugin UIs can be hook-free `React.Component`
 * classes (see PluginComponent) instead of `ContextHooks`-calling function components.
 *
 * Mirrors the theme's ThemeRuntime and the admin's AdminRuntime. Exposed to plugins through
 * `@fromcode119/sdk/react`.
 */
export interface PluginRuntimeValue {
  /** The plugins registry (PluginContextRegistry value): api, getPluginApi, hasPluginApi, … */
  plugins: any;
  translation: TranslationContextValue;
  globalSettings: Record<string, any>;
  collections: any[];
  /** Active locale code (e.g. 'en', 'bg'), derived from the translation context (`translation.locale`). */
  locale: string;
  /** Plugin API client surface, from ContextHooks.useAPI(). */
  api: any;
}

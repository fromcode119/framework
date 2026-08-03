import type { ITranslationContextValue } from '@react/context/interfaces/translation-context-value.interface';

/**
 * Context-backed values plugin UI components need, read ONCE by {@link PluginRuntimeProvider}
 * and published via PluginRuntimeContext so plugin UIs can be hook-free `React.Component`
 * classes (see PluginComponent) instead of `ContextHooks`-calling function components.
 *
 * Mirrors the theme's ThemeRuntime and the admin's AdminRuntime. Exposed to plugins through
 * `@fromcode119/sdk/react`.
 */
export class PluginRuntimeValue {
  /** The plugins registry (PluginContextRegistry value): api, getPluginApi, hasPluginApi, … */
  declare plugins: any;
  declare translation: ITranslationContextValue;
  declare globalSettings: Record<string, any>;
  declare collections: any[];
  /** Active locale code (e.g. 'en', 'bg'), derived from the translation context (`translation.locale`). */
  declare locale: string;
  /** Plugin API client surface, from ContextHooks.useAPI(). */
  declare api: any;
}

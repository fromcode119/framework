import { ContextBridge, PluginUiRegistrar } from '@fromcode119/sdk/react';

// STOREFRONT plugin-UI entry. Copied VERBATIM into a plugin's src/ui as `.plugin-entry.tsx` at build
// time, which is why it carries no relative imports and duplicates the admin variant: only this one file
// is copied, so anything it imported from a sibling would not resolve. The `__plugin*` globals are
// injected by the Vite config's `define` and declared in `plugin-ui-globals.d.ts`.

/**
 * Discovers and registers a plugin's STOREFRONT UI.
 *
 * Same as the admin entry, but the glob takes ONLY `*.storefront.*` files — the plugin-client, onMount
 * runtimes, storefront components/blocks/renderers/transformers. Admin-only code (dashboards, fields,
 * charts) is never pulled into the storefront bundle.
 *
 * The globs are static class fields because `import.meta.glob` is a SYNTACTIC transform — Vite rewrites
 * the call wherever it appears, provided its arguments are literals — and they must be declared before
 * the initialiser that reads them.
 */
export class PluginUiStorefrontEntry {
  private static readonly modules = import.meta.glob<Record<string, unknown>>(
    ['./**/*.storefront.{ts,tsx}'],
    { eager: true },
  );

  /**
   * `src/ui/i18n/<locale>.json`, keyed by FILENAME into one per-locale map, so `bg.json` lands in the
   * `bg` bucket and `en.json` in `en`. Registering each file on its own would make every dict a
   * locale-agnostic (wildcard) registration and the last file loaded would win for every language.
   */
  private static readonly locales = import.meta.glob<{ default: unknown }>('./i18n/*.json', { eager: true });

  /**
   * Runs on CLASS evaluation, which for an entry module is module evaluation. A static field initialiser
   * rather than a top-level `PluginUiStorefrontEntry.boot()` statement: the class is EXPORTED from an
   * entry chunk, so the bundler must preserve it, and the module then contains nothing but the class.
   */
  private static readonly booted = PluginUiStorefrontEntry.boot();

  private static boot(): boolean {
    PluginUiStorefrontEntry.registerTranslations();
    PluginUiStorefrontEntry.registerComponents();
    return true;
  }

  private static get translationsByLocale(): Record<string, unknown> {
    const byLocale: Record<string, unknown> = {};
    for (const [file, mod] of Object.entries(PluginUiStorefrontEntry.locales)) {
      const locale = (file.split('/').pop() || '').replace(/\.json$/i, '').trim();
      if (locale) byLocale[locale] = (mod as { default?: unknown }).default ?? mod;
    }
    return byLocale;
  }

  private static registerTranslations(): void {
    const byLocale = PluginUiStorefrontEntry.translationsByLocale;
    if (Object.keys(byLocale).length) ContextBridge.registerTranslations(byLocale);
    // English doubles as the locale-agnostic base (the same fallback the server-side I18nManager
    // applies), so a locale whose file omits a key still renders copy instead of the raw key. The
    // locale bucket wins.
    if (byLocale.en) ContextBridge.registerTranslations(byLocale.en);
  }

  private static registerComponents(): void {
    const context = { pluginSlug: __pluginSlug, namespace: __pluginNamespace, uiBundle: __uiBundle };
    for (const mod of Object.values(PluginUiStorefrontEntry.modules)) {
      for (const value of Object.values(mod)) PluginUiRegistrar.register(value, context);
    }
  }
}

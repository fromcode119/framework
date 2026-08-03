import { ContextBridge, PluginUiRegistrar } from '@fromcode119/sdk/react';

// ADMIN plugin-UI entry. Copied VERBATIM into a plugin's src/ui as `.plugin-entry.tsx` at build time,
// which is why it carries no relative imports and duplicates the storefront variant: only this one file
// is copied, so anything it imported from a sibling would not resolve. The `__plugin*` globals are
// injected by the Vite config's `define` and declared in `plugin-ui-globals.d.ts`.

/**
 * Discovers and registers a plugin's UI.
 *
 * Vite's `import.meta.glob` finds every component and the framework registrar decides which are
 * plugin-UI components and wires each to the right registry — the theme's model, no generator. The
 * admin bundle carries ALL components; the storefront bundle (`plugin-ui-entry.storefront.tsx`) globs
 * only `*.storefront.*`, so admin-only code never bloats the storefront.
 *
 * The globs are static class fields because `import.meta.glob` is a SYNTACTIC transform — Vite rewrites
 * the call wherever it appears, provided its arguments are literals — and they must be declared before
 * the initialiser that reads them.
 */
export class PluginUiEntry {
  private static readonly modules = import.meta.glob<Record<string, unknown>>(
    [
      './**/*.{ts,tsx}',
      '!./**/*.interfaces.ts', '!./**/*.types.ts', '!./**/*.enums.ts',
      '!./**/*.test.{ts,tsx}', '!./**/*.spec.{ts,tsx}', '!./**/__tests__/**',
      '!./.plugin-entry.tsx',
    ],
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
   * rather than a top-level `PluginUiEntry.boot()` statement: the class is EXPORTED from an entry chunk,
   * so the bundler must preserve it, and the module then contains nothing but the class.
   */
  private static readonly booted = PluginUiEntry.boot();

  private static boot(): boolean {
    PluginUiEntry.registerTranslations();
    PluginUiEntry.registerComponents();
    return true;
  }

  private static get translationsByLocale(): Record<string, unknown> {
    const byLocale: Record<string, unknown> = {};
    for (const [file, mod] of Object.entries(PluginUiEntry.locales)) {
      const locale = (file.split('/').pop() || '').replace(/\.json$/i, '').trim();
      if (locale) byLocale[locale] = (mod as { default?: unknown }).default ?? mod;
    }
    return byLocale;
  }

  private static registerTranslations(): void {
    const byLocale = PluginUiEntry.translationsByLocale;
    if (Object.keys(byLocale).length) ContextBridge.registerTranslations(byLocale);
    // English doubles as the locale-agnostic base (the same fallback the server-side I18nManager
    // applies), so a locale whose file omits a key still renders copy instead of the raw key. The
    // locale bucket wins.
    if (byLocale.en) ContextBridge.registerTranslations(byLocale.en);
  }

  private static registerComponents(): void {
    const context = { pluginSlug: __pluginSlug, namespace: __pluginNamespace, uiBundle: __uiBundle };
    for (const mod of Object.values(PluginUiEntry.modules)) {
      for (const value of Object.values(mod)) PluginUiRegistrar.register(value, context);
    }
  }
}

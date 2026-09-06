import { describe, expect, it } from 'vitest';
import { FrontendI18nService } from '@fromcode119/react/context/frontend-i18n-service';
import { ServerTranslator } from '@/lib/ssr/server-translator';
import { ThemeServerRegistry } from '@/lib/ssr/theme-server-registry';

/**
 * Precedence must be a DECLARED layer, never registration order.
 *
 * Plugins and themes both register through the same `registerTranslations` call, as a side effect of
 * their bundle being imported, and the plugin bundle evaluates last. While the layer was implicit,
 * the plugin won every collision — the inverse of "Plugin Owns Default Design — Theme Is Only an
 * Override": adding a key a plugin had no reason to own silently replaced the site's own wording.
 * The second argument (`'theme'`) is what states the layer; the buckets below are what the provider
 * folds each call into.
 *
 * `ServerTranslator` is asserted alongside because the server pre-render resolves through the same
 * service; a drift between the two shows as text changing between the server paint and hydration.
 */
describe('FrontendI18nService layering', () => {
  const server = { lms: { shared: 'server' } };
  const pluginLayer = FrontendI18nService.foldRegistration({}, {
    bg: { lms: { shared: 'plugin', reviews: { title: 'Отзиви за курсове' }, onlyPlugin: 'plugin-only' } },
  });
  const themeLayer = FrontendI18nService.foldRegistration({}, {
    bg: { lms: { shared: 'theme', reviews: { title: 'Отзиви' } } },
  });

  it('resolves the theme value over the plugin default for the same key', () => {
    const dict = FrontendI18nService.resolveEffective(server, pluginLayer, 'bg', themeLayer);
    expect(FrontendI18nService.translate(dict, 'lms.reviews.title')).toBe('Отзиви');
    expect(FrontendI18nService.translate(dict, 'lms.shared')).toBe('theme');
  });

  it('keeps the plugin default for keys the theme does not override', () => {
    const dict = FrontendI18nService.resolveEffective(server, pluginLayer, 'bg', themeLayer);
    expect(FrontendI18nService.translate(dict, 'lms.onlyPlugin')).toBe('plugin-only');
  });

  it('is independent of the order the two layers were folded in', () => {
    // The regression: swapping which bucket was written first used to swap the winner.
    const themeFirst = FrontendI18nService.resolveEffective(server, pluginLayer, 'bg', themeLayer);
    const pluginRefolded = FrontendI18nService.foldRegistration(pluginLayer, { bg: { lms: { late: 'plugin' } } });
    const pluginLast = FrontendI18nService.resolveEffective(server, pluginRefolded, 'bg', themeLayer);
    expect(pluginLast.lms).toMatchObject({ ...(themeFirst.lms as object), late: 'plugin' });
    expect(FrontendI18nService.translate(pluginLast, 'lms.reviews.title')).toBe('Отзиви');
  });

  it('lets a theme wildcard (legacy flat) registration beat a locale-specific plugin value', () => {
    const flatTheme = FrontendI18nService.foldRegistration({}, { lms: { shared: 'theme-flat' } });
    const dict = FrontendI18nService.resolveEffective(server, pluginLayer, 'bg', flatTheme);
    expect(FrontendI18nService.translate(dict, 'lms.shared')).toBe('theme-flat');
  });

  it('falls back to the server dictionary when neither layer supplies the key', () => {
    const dict = FrontendI18nService.resolveEffective({ only: { onServer: 'yes' } }, pluginLayer, 'bg', themeLayer);
    expect(FrontendI18nService.translate(dict, 'only.onServer')).toBe('yes');
  });

  it('resolves the same way with no theme layer at all (plugin-only install)', () => {
    const dict = FrontendI18nService.resolveEffective(server, pluginLayer, 'bg');
    expect(FrontendI18nService.translate(dict, 'lms.reviews.title')).toBe('Отзиви за курсове');
  });

  it('gives ServerTranslator the same precedence as the browser resolution', () => {
    const translator = new ServerTranslator(server, pluginLayer, 'bg', themeLayer);
    expect(translator.translate('lms.reviews.title')).toBe('Отзиви');
    expect(translator.translate('lms.onlyPlugin')).toBe('plugin-only');
    expect(translator.effective).toEqual(
      FrontendI18nService.resolveEffective(server, pluginLayer, 'bg', themeLayer),
    );
  });

  // The SSR half of the same contract: one `registerTranslations`, routed by its second argument.
  // If this drifts from the provider's routing, the server paints one wording and hydration another.
  it('routes a registerTranslations payload to the bucket its layer argument names', () => {
    let bridge: Record<string, (...args: unknown[]) => unknown> = {};
    ThemeServerRegistry.install({ install: (args: unknown) => { bridge = args as typeof bridge; } }, {});

    // Registrations belong to the generation being built; a reader names that generation.
    const generation = ThemeServerRegistry.beginGeneration();
    bridge.registerTranslations({ bg: { demo: { key: 'from-plugin' } } });
    bridge.registerTranslations({ bg: { demo: { key: 'from-theme' } } }, FrontendI18nService.THEME_LAYER);
    ThemeServerRegistry.publishGeneration('theme:i18n@1', generation);

    expect(ThemeServerRegistry.translationPayloads('theme:i18n@1')).toEqual([{ bg: { demo: { key: 'from-plugin' } } }]);
    expect(ThemeServerRegistry.themeTranslationPayloads('theme:i18n@1')).toEqual([{ bg: { demo: { key: 'from-theme' } } }]);
  });
});

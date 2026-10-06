import { CoercionUtils, LocalizationUtils, RequestContextUtils } from '@fromcode119/core';
import type { IPluginReadRoute } from '@fromcode119/core';

/**
 * Which entry of a stored per-language document (`documentByLocale`) a request is answered with: the
 * request's language, and — when the route declares a `documentVariant` and the request names one — that
 * variant too (`bg:EUR`). A request that names a variant the route does not accept is not the route's.
 */
export class PluginReadRouteDocument {
  private static readonly patterns = new Map<string, RegExp | null>();

  /** Whether the request's variant, if it names one, is one the route declares it can answer. */
  static accepts(route: IPluginReadRoute, query: Record<string, unknown>): boolean {
    const variant = route.documentVariant;
    const value = variant ? CoercionUtils.toString(query[variant.param]).trim() : '';
    if (!variant || value === '') return true;
    return PluginReadRouteDocument.pattern(variant.accepts).test(value);
  }

  /** The entry key for this request: the short language code, then `:VARIANT` when one is named. */
  static key(route: IPluginReadRoute, query: Record<string, unknown>): string {
    const language = LocalizationUtils.normalizeLocaleCode(RequestContextUtils.getLocale(), { short: true });
    const variant = route.documentVariant ? CoercionUtils.toString(query[route.documentVariant.param]).trim().toUpperCase() : '';
    return variant ? `${language}:${variant}` : language;
  }

  /** The stored document as this request is answered with it; a per-language one has no fallback entry. */
  static pick(route: IPluginReadRoute, stored: unknown, query: Record<string, unknown>): unknown {
    if (!route.documentByLocale) return stored;
    return (stored as Record<string, unknown> | null | undefined)?.[PluginReadRouteDocument.key(route, query)];
  }

  private static pattern(source: string): RegExp {
    let compiled = PluginReadRouteDocument.patterns.get(source);
    if (compiled === undefined) {
      try { compiled = new RegExp(source, 'u'); } catch { compiled = null; }
      PluginReadRouteDocument.patterns.set(source, compiled);
    }
    return compiled ?? /(?!)/u;
  }
}

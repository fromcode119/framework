import { PhysicalTableNameUtils } from '@fromcode119/database/physical-table-name-utils';
import { LocalizationUtils } from '@core/localization';
import { RequestContextUtils } from '@core/context/request-context';
import type { ICollection } from '@core/interfaces/collection.interface';
import type { IField } from '@core/interfaces/field.interface';
import type { IPluginManagerInterface } from '@core/plugin/context/interfaces/plugin-manager-interface.interface';

/**
 * Resolves `localized: true` field values on rows read through a plugin's `context.db`.
 *
 * Localized values are stored as a per-locale map (JSON text in the column). The framework's REST
 * controller has always resolved them for `/collections/...`, but a plugin's OWN endpoints read
 * through `context.db` and so returned the raw map — so the moment an operator filled in a second
 * locale, a storefront reading records through a plugin's API rendered the serialized map itself
 * (`{"bg":"…","en":"…"}`) where the title belonged.
 *
 * This closes that gap in the ONE place every plugin DB read passes through, rather than in each
 * plugin — the same argument as {@link EnumValueCoercion} next door, and the reason the localized
 * flag can be turned on for products, courses, pages and posts without four copies of this rule.
 *
 * Resolution mirrors the REST controller: prefer the request's locale, otherwise the first locale in
 * the map carrying a meaningful value. The request locale is already the platform's configured
 * default when the caller did not ask for one (the API's locale middleware resolves it that way), so
 * an unfilled locale degrades to the default rather than to nothing.
 *
 * A value that is NOT a locale map is returned untouched, which is what keeps every pre-existing flat
 * string working: those rows read exactly as they did before this class existed.
 */
export class LocalizedReadResolver {
  /** Rows as read from the DB, with every localized field collapsed to the active locale's value. */
  static resolveResult(result: unknown, table: unknown, manager: IPluginManagerInterface): unknown {
    if (result == null) return result;

    const localizedFields = LocalizedReadResolver.resolveLocalizedFields(table, manager);
    if (!localizedFields.length) return result;

    const locale = LocalizationUtils.normalizeLocaleCode(RequestContextUtils.getLocale(), { short: true });
    if (Array.isArray(result)) {
      return result.map((row) => LocalizedReadResolver.resolveRow(row, localizedFields, locale));
    }
    return LocalizedReadResolver.resolveRow(result, localizedFields, locale);
  }

  private static resolveRow(row: unknown, localizedFields: string[], locale: string): unknown {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return row;

    let resolved: Record<string, unknown> | null = null;
    for (const fieldName of localizedFields) {
      const localeMap = LocalizedReadResolver.asLocaleMap((row as Record<string, unknown>)[fieldName]);
      // Not a locale map — a legacy flat value, or simply absent. Left exactly as stored.
      if (!localeMap) continue;

      if (!resolved) resolved = { ...(row as Record<string, unknown>) };
      resolved[fieldName] = LocalizedReadResolver.pickLocaleValue(localeMap, locale);
    }

    return resolved ?? row;
  }

  /**
   * The value as a locale map, or `null` when it is not one.
   *
   * Both shapes have to be accepted: a text column hands back the map as JSON TEXT, while an insert /
   * update return (and a jsonb column) hands back a real object. `isLocaleMap` is the gate in both
   * cases because it requires EVERY key to be a valid locale code — `tryParseLocaleJson` alone would
   * happily treat any JSON object, such as a plugin's own `{"foo":1}` settings blob, as translations.
   */
  private static asLocaleMap(value: unknown): Record<string, unknown> | null {
    const candidate = typeof value === 'string' ? LocalizationUtils.tryParseLocaleJson(value) : value;
    return LocalizationUtils.isLocaleMap(candidate) ? candidate : null;
  }

  /**
   * The active locale's value, else the first locale carrying one. `null`/`''`/`undefined` slots are
   * skipped so a half-translated record falls through to the locale that actually has the copy instead
   * of rendering blank.
   */
  private static pickLocaleValue(localeMap: Record<string, unknown>, locale: string): unknown {
    if (locale && LocalizedReadResolver.isMeaningful(localeMap[locale])) return localeMap[locale];

    for (const value of Object.values(localeMap)) {
      if (LocalizedReadResolver.isMeaningful(value)) return value;
    }
    return '';
  }

  private static isMeaningful(value: unknown): boolean {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    return true;
  }

  /**
   * The localized field names declared by the collection behind `table`.
   *
   * Plugins address their tables semantically (`@<plugin>/widgets`) while the registry is keyed on
   * the PHYSICAL name (`fcp_ecommerce_products`), so the reference is parsed and rebuilt. The registry
   * hands back a `{ collection, pluginSlug }` entry rather than the collection itself.
   *
   * Deliberately NOT cached. `CollectionsContextProxy` merges an extension INTO the already-registered
   * collection object — that is how the SEO plugin adds its fields to products, courses, pages and
   * posts after those plugins have registered — so a cache keyed on the collection (or on its fields
   * array) can freeze a pre-extension list and silently drop every SEO field. Filtering a field array
   * is nothing next to the query that just ran.
   */
  private static resolveLocalizedFields(table: unknown, manager: IPluginManagerInterface): string[] {
    const reference = PhysicalTableNameUtils.parse(String(table ?? '').trim());
    if (!reference) return [];

    const entry = manager.getCollection(
      PhysicalTableNameUtils.create(reference.pluginSlug, reference.tableName),
    ) as { collection?: ICollection } | null | undefined;

    const fields = entry?.collection?.fields;
    if (!Array.isArray(fields)) return [];

    return fields
      .filter((field: IField) => Boolean(field?.localized))
      .map((field: IField) => String(field.name));
  }
}

import { CoercionUtils } from '@fromcode119/core/client';
import type { IFieldFallbackRule } from '@/lib/collection/interfaces/field-fallback-rule.interface';

/**
 * Answers, for ONE field on ONE record, the question the admin could not previously answer:
 * *"this box is empty — so what does the site actually use, and who decided that?"*
 *
 * A field whose empty value silently resolves to a plugin setting is indistinguishable, in the admin,
 * from a field that resolves to nothing. That gap is how a product with blank lead-time boxes came to
 * advertise a 10–15 day delivery window on the storefront: the number was real and configurable, but
 * nothing on the product screen said it existed, named it, or linked to it.
 *
 * A field declares where it falls back to via `admin.fallback` — one rule, or several tried in order so
 * a field can inherit from different settings depending on the record (a made-to-order product reads the
 * preparation window; a stocked one reads the dispatch window). This class only REPORTS; it never
 * changes a value.
 */
export class FieldProvenance {
  /** `own` = the record's own value; `inherited` = empty, a setting decides; `none` = empty, nothing renders. */
  readonly kind: 'own' | 'inherited' | 'none';
  readonly effectiveValue: string;
  readonly settingLabel: string;
  readonly settingsHref: string;
  readonly settingsTab: string;
  readonly emptyMeans: string;

  private constructor(init: Partial<FieldProvenance> & { kind: FieldProvenance['kind'] }) {
    this.kind = init.kind;
    this.effectiveValue = init.effectiveValue ?? '';
    this.settingLabel = init.settingLabel ?? '';
    this.settingsHref = init.settingsHref ?? '';
    this.settingsTab = init.settingsTab ?? '';
    this.emptyMeans = init.emptyMeans ?? '';
  }

  /** A value the operator actually typed — treat 0 and false as real, only null/undefined/'' as absent. */
  private static isPresent(value: unknown): boolean {
    return value !== null && value !== undefined && String(value).trim() !== '';
  }

  private static ruleApplies(rule: IFieldFallbackRule, record: Record<string, any>): boolean {
    if (!rule.when) return true;
    const actual = record?.[rule.when.field];
    const expected = rule.when.equals;
    // Records arrive from SQLite with booleans as 1/0/"1.0", so a boolean expectation compares on
    // coerced truthiness — a raw `===` here silently made every rule fail. Matching the two boolean
    // LITERALS says exactly that without a `typeof` guard, which the house rules forbid.
    if (expected === true || expected === false) {
      return CoercionUtils.toBoolean(actual, false) === expected;
    }
    return CoercionUtils.toString(actual) === CoercionUtils.toString(expected);
  }

  /** The setting's own declared label, so the admin never repeats copy the schema already owns. */
  private static labelFor(settingKey: string, schema: Record<string, any> | undefined): string {
    const field = (schema?.fields || []).find((entry: any) => entry?.name === settingKey);
    return CoercionUtils.toString(field?.label) || settingKey;
  }

  /** The tab that setting sits on, by its DISPLAY name — again from the schema, not repeated in a rule. */
  private static tabFor(settingKey: string, schema: Record<string, any> | undefined): string {
    const field = (schema?.fields || []).find((entry: any) => entry?.name === settingKey);
    const tabId = CoercionUtils.toString(field?.tab);
    if (!tabId) return '';
    const tab = (schema?.tabs || []).find((entry: any) => entry?.id === tabId);
    return CoercionUtils.toString(tab?.label) || tabId;
  }

  /**
   * @param rules       the field's `admin.fallback` (one rule or an ordered list; first match wins)
   * @param value       the field's current value on this record
   * @param record      the whole form record, so a rule can be conditional on a sibling field
   * @param settings    the owning plugin's EFFECTIVE settings (stored values merged over schema defaults)
   * @param settingsHref admin link to that plugin's settings screen
   * @param schema      that plugin's settings SCHEMA — the single source of each setting's label and tab
   */
  static resolve(
    rules: IFieldFallbackRule | IFieldFallbackRule[] | undefined,
    value: unknown,
    record: Record<string, any>,
    settings: Record<string, any>,
    settingsHref: string,
    schema?: Record<string, any>,
  ): FieldProvenance | null {
    if (!rules) return null;
    if (FieldProvenance.isPresent(value)) return new FieldProvenance({ kind: 'own' });

    const list = Array.isArray(rules) ? rules : [rules];
    for (const rule of list) {
      if (!FieldProvenance.ruleApplies(rule, record)) continue;
      const inherited = settings?.[rule.settingKey];
      if (!FieldProvenance.isPresent(inherited)) {
        // The rule matched but the setting it points at is itself blank — so nothing is rendered, and
        // saying "inherits from X" would be a lie. Report the real outcome instead.
        return new FieldProvenance({ kind: 'none', emptyMeans: rule.emptyMeans ?? '' });
      }
      return new FieldProvenance({
        kind: 'inherited',
        effectiveValue: CoercionUtils.toString(inherited),
        settingLabel: FieldProvenance.labelFor(rule.settingKey, schema),
        settingsTab: FieldProvenance.tabFor(rule.settingKey, schema),
        settingsHref,
      });
    }
    return new FieldProvenance({ kind: 'none', emptyMeans: list[0]?.emptyMeans ?? '' });
  }
}

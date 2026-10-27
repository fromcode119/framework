import { PersonFieldType } from '@core/plugin/services/people/fields/person-field-type.enum';

/** A value as stored: what the type allows, or null for "not given". */
export type PersonFieldStoredValue = string | number | boolean | string[] | null;

/** Thrown when a value does not fit its field; `field` is the key, so a client can point at the input. */
export class PersonFieldValueError extends Error {
  constructor(readonly field: string, readonly reason: string) {
    super(`${field}: ${reason}`);
  }
}

/**
 * Checks one value against its field's type and turns it into what is stored. Untrusted input (an app,
 * an import) goes through here, so nothing reaches the table that its field cannot show back.
 */
export class PersonFieldValue {
  static readonly TEXT_MAX = 500;
  static readonly LONG_TEXT_MAX = 10_000;
  private static readonly DATE = /^\d{4}-\d{2}-\d{2}$/;
  private static readonly TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

  /** `options` are the allowed keys of a choice field. */
  static normalize(key: string, type: PersonFieldType, raw: unknown, options: readonly string[] = []): PersonFieldStoredValue {
    if (raw === null || raw === undefined || raw === '') return null;
    switch (type) {
      case PersonFieldType.TEXT:
      case PersonFieldType.PLACE:
        return PersonFieldValue.text(key, raw, PersonFieldValue.TEXT_MAX);
      case PersonFieldType.LONG_TEXT:
        return PersonFieldValue.text(key, raw, PersonFieldValue.LONG_TEXT_MAX);
      case PersonFieldType.NUMBER:
        return PersonFieldValue.number(key, raw);
      case PersonFieldType.BOOLEAN:
        if (raw === true || raw === false) return raw;
        throw new PersonFieldValueError(key, 'boolean');
      case PersonFieldType.DATE:
        return PersonFieldValue.date(key, raw);
      case PersonFieldType.TIME:
        return PersonFieldValue.matching(key, raw, PersonFieldValue.TIME, 'time');
      case PersonFieldType.DATETIME:
        return PersonFieldValue.datetime(key, raw);
      case PersonFieldType.CHOICE:
        return PersonFieldValue.choice(key, raw, options);
      case PersonFieldType.CHOICES:
        return PersonFieldValue.choices(key, raw, options);
      default:
        throw new PersonFieldValueError(key, 'type');
    }
  }

  private static text(key: string, raw: unknown, max: number): string | null {
    if (typeof raw !== 'string' && typeof raw !== 'number') throw new PersonFieldValueError(key, 'text');
    const text = String(raw).trim();
    if (text.length > max) throw new PersonFieldValueError(key, 'tooLong');
    return text || null;
  }

  private static number(key: string, raw: unknown): number {
    const value = typeof raw === 'number' ? raw : Number(String(raw).trim());
    if (!Number.isFinite(value)) throw new PersonFieldValueError(key, 'number');
    return value;
  }

  private static matching(key: string, raw: unknown, pattern: RegExp, reason: string): string {
    const text = String(raw).trim();
    if (!pattern.test(text)) throw new PersonFieldValueError(key, reason);
    return text;
  }

  /** A calendar date that exists: `2023-02-30` is refused, not rolled into March. */
  private static date(key: string, raw: unknown): string {
    const text = PersonFieldValue.matching(key, raw, PersonFieldValue.DATE, 'date');
    const parsed = new Date(`${text}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== text) throw new PersonFieldValueError(key, 'date');
    return text;
  }

  private static datetime(key: string, raw: unknown): string {
    const parsed = new Date(String(raw).trim());
    if (Number.isNaN(parsed.getTime())) throw new PersonFieldValueError(key, 'datetime');
    return parsed.toISOString();
  }

  private static choice(key: string, raw: unknown, options: readonly string[]): string {
    const value = String(raw).trim();
    if (!options.includes(value)) throw new PersonFieldValueError(key, 'choice');
    return value;
  }

  private static choices(key: string, raw: unknown, options: readonly string[]): string[] | null {
    if (!Array.isArray(raw)) throw new PersonFieldValueError(key, 'choices');
    const picked = [...new Set(raw.map((item) => String(item).trim()))];
    if (picked.some((item) => !options.includes(item))) throw new PersonFieldValueError(key, 'choice');
    return picked.length ? picked : null;
  }
}

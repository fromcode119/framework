import type { ICatalogDb } from '@core/plugin/services/interfaces/catalog-db.interface';
import { NamingStrategy } from '@fromcode119/database';
import { SystemConstants } from '@core/constants/system.constants';
import { PersonFieldType } from '@core/plugin/services/people/fields/person-field-type.enum';
import { PersonFieldValue, PersonFieldValueError, type PersonFieldStoredValue } from '@core/plugin/services/people/fields/person-field-value';
import type { IPersonField, IPersonFieldInput } from '@core/plugin/services/people/fields/person-field.interface';

/**
 * The site's person fields and each person's values for them. Every reader — the admin, a plugin through
 * `context.people.fields`, an app through `/me/person/fields` — goes through here, so a value is always
 * checked against the field the operator declared.
 */
export class PersonFieldService {
  private static readonly KEY = /^[a-z][a-zA-Z0-9]{0,63}$/;

  constructor(private readonly db: ICatalogDb) {}

  async list(): Promise<IPersonField[]> {
    const rows = await this.db.find(SystemConstants.TABLE.PERSON_FIELDS, { orderBy: { sortOrder: 'asc' } });
    return (rows ?? []).map((row) => PersonFieldService.toField(row));
  }

  async get(key: string): Promise<IPersonField | null> {
    const row = await this.db.findOne(SystemConstants.TABLE.PERSON_FIELDS, { key: String(key ?? '').trim() });
    return row ? PersonFieldService.toField(row) : null;
  }

  /** Creates or updates one declaration. The key never changes once values exist under it. */
  async save(input: IPersonFieldInput): Promise<IPersonField> {
    const key = String(input?.key ?? '').trim();
    if (!PersonFieldService.KEY.test(key)) throw new PersonFieldValueError('key', 'key');
    const type = PersonFieldType.fromValue(String(input?.type ?? '')) as PersonFieldType | undefined;
    if (!type) throw new PersonFieldValueError('type', 'type');
    const options = (input.options ?? []).map((option) => ({ key: String(option?.key ?? '').trim(), label: option?.label ?? {} })).filter((option) => option.key);
    const data = {
      label: input.label ?? {},
      type: type.value,
      options,
      description: input.description ?? {},
      selfEditable: input.selfEditable === true,
      sortOrder: Number.isFinite(Number(input.sortOrder)) ? Number(input.sortOrder) : 0,
      updatedAt: new Date(),
    };
    const existing = await this.db.findOne(SystemConstants.TABLE.PERSON_FIELDS, { key });
    if (existing) await this.db.update(SystemConstants.TABLE.PERSON_FIELDS, { key }, data);
    else await this.db.insert(SystemConstants.TABLE.PERSON_FIELDS, { key, ...data });
    return (await this.get(key)) as IPersonField;
  }

  /** Removes the declaration and every value stored under it. */
  async remove(key: string): Promise<boolean> {
    const field = await this.get(key);
    if (!field) return false;
    await this.db.delete(SystemConstants.TABLE.PERSON_FIELD_VALUES, { fieldKey: field.key });
    await this.db.delete(SystemConstants.TABLE.PERSON_FIELDS, { key: field.key });
    return true;
  }

  /** One person's values, keyed by field. A field with no value is absent, never invented. */
  async values(personId: number): Promise<Record<string, PersonFieldStoredValue>> {
    const rows = await this.db.find(SystemConstants.TABLE.PERSON_FIELD_VALUES, { where: { personId } });
    const result: Record<string, PersonFieldStoredValue> = {};
    for (const raw of rows ?? []) {
      const row = NamingStrategy.denormalizeRecord(raw);
      const value = PersonFieldService.decode(row?.value);
      if (value !== null) result[String(row.fieldKey)] = value;
    }
    return result;
  }

  /**
   * Writes several values at once; all are checked before any is stored. `selfOnly` limits the write to
   * fields the operator marked as editable by the person themselves.
   */
  async setValues(personId: number, values: Record<string, unknown>, options: { selfOnly?: boolean } = {}): Promise<Record<string, PersonFieldStoredValue>> {
    const fields = new Map((await this.list()).map((field) => [field.key, field]));
    const checked: [string, PersonFieldStoredValue][] = [];
    for (const [key, raw] of Object.entries(values ?? {})) {
      const field = fields.get(key);
      if (!field || (options.selfOnly && !field.selfEditable)) throw new PersonFieldValueError(key, 'unknownField');
      const type = PersonFieldType.fromValue(field.type) as PersonFieldType;
      checked.push([key, PersonFieldValue.normalize(key, type, raw, field.options.map((option) => option.key))]);
    }
    for (const [fieldKey, value] of checked) await this.write(personId, fieldKey, value);
    return this.values(personId);
  }

  async eraseFor(personId: number): Promise<void> {
    await this.db.delete(SystemConstants.TABLE.PERSON_FIELD_VALUES, { personId });
  }

  private async write(personId: number, fieldKey: string, value: PersonFieldStoredValue): Promise<void> {
    const where = { personId, fieldKey };
    if (value === null) {
      await this.db.delete(SystemConstants.TABLE.PERSON_FIELD_VALUES, where);
      return;
    }
    // Wrapped: the JSON column parses any string that looks like JSON, so a bare text answer "123" or
    // "true" would come back as a number or a boolean. An object reads back the same on every driver.
    const encoded = JSON.stringify({ value });
    const existing = await this.db.findOne(SystemConstants.TABLE.PERSON_FIELD_VALUES, where);
    if (existing) await this.db.update(SystemConstants.TABLE.PERSON_FIELD_VALUES, where, { value: encoded, updatedAt: new Date() });
    else await this.db.insert(SystemConstants.TABLE.PERSON_FIELD_VALUES, { ...where, value: encoded });
  }

  /** Postgres hands JSONB back parsed; a driver that returns the text is parsed here. */
  private static decode(stored: unknown): PersonFieldStoredValue {
    const wrapper = typeof stored === 'string' ? JSON.parse(stored) : stored;
    return (wrapper as { value?: PersonFieldStoredValue } | null)?.value ?? null;
  }

  private static toField(raw: any): IPersonField {
    const row = NamingStrategy.denormalizeRecord(raw);
    return {
      key: String(row.key),
      label: row.label ?? {},
      type: String(row.type),
      options: Array.isArray(row.options) ? row.options : [],
      description: row.description ?? {},
      selfEditable: row.selfEditable === true,
      sortOrder: Number(row.sortOrder ?? 0),
    };
  }
}

import { ICollection } from '@fromcode119/core';
import { LocalizationService } from '@api/services/localization-service';
import { FieldType } from '@fromcode119/core';

export class DataProcessorService {
  constructor(
    private auth: any,
    private localization: LocalizationService
  ) {}

  public async processIncomingData(
    collection: ICollection,
    data: any,
    table: any,
    options: {
      existingRecord?: any;
      localeContext: { locale: string; defaultLocale: string };
      overrideFields?: Set<string>;
    }
  ) {
    const processedData: any = {};
    const overrideFields = options?.overrideFields;

    for (const key of Object.keys(data || {})) {
      if (!table[key]) continue;

      let value = data[key];
      const fieldConfig: any = collection.fields.find((f) => f.name === key);

      // Skip auto-managed timestamps — unless the caller authorized an explicit read-only
      // override for them (admin unlocked "Created Date" / "Updated" + password-confirmed).
      if (key === 'createdAt' && !overrideFields?.has('createdAt')) continue;
      if (key === 'updatedAt' && collection.slug !== 'settings' && !overrideFields?.has('updatedAt')) continue;

      // Password hashing
      if (collection.slug === 'users' && key === 'password' && this.auth && value) {
        value = await this.auth.hashPassword(value);
      }

      if (fieldConfig?.localized) {
        const existingMap =
          this.localization.parseLocaleMap(options?.existingRecord?.[key]) ||
          this.localization.parseLocaleMap(value) ||
          {};

        const incomingMap = this.localization.parseLocaleMap(value);
        const nextMap = { ...existingMap };

        if (incomingMap) {
          Object.assign(nextMap, incomingMap);
        } else if (this.localization.isJunkForLocaleSlot(fieldConfig, value)) {
          // Skip the field entirely so the stored value survives (a written-back map would wipe a
          // legacy plain-string value). Clearing a slot is expressed by an empty STRING, never an object.
          continue;
        } else {
          nextMap[options.localeContext.locale] = value;
        }

        value = this.localization.serializeLocaleMap(fieldConfig, nextMap);
        processedData[key] = value;
        continue;
      }

      // JSON/Array coercion
      const isJsonType = fieldConfig && this.localization.isJsonStorageField(fieldConfig.type);
      
      if (isJsonType) {
        if (value === '' || value === undefined || value === null) {
          value = null;
        }
      }

      if (fieldConfig && fieldConfig.type === 'array') {
        if (value === '' || value === undefined || value === null) {
          value = null;
        } else if (typeof value !== 'string') {
           value = JSON.stringify(value);
        }
      }

      if (fieldConfig && fieldConfig.type === 'date' && value && typeof value === 'string') {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          value = date;
        }
      }

      // A UNIQUE field must store NULL (not '') when empty. Empty strings are NOT exempt
      // from a UNIQUE constraint the way NULL is, so two "unset" rows (e.g. products with no
      // custom permalink) both written as '' collide and the whole write fails with a UNIQUE
      // violation. Coercing empty → null lets any number of rows be "unset".
      if (fieldConfig?.unique && (value === '' || value === undefined)) {
        value = null;
      }

      processedData[key] = value;
    }

    // `updatedAt` is auto-managed — incoming values are dropped above — so it has to be MANAGED here.
    // The column's DEFAULT only fires on insert: without this, a record saved through the admin kept its
    // creation time as "Updated" forever (every list's Updated At column, a form's "Last saved").
    if (options?.existingRecord && table.updatedAt && processedData.updatedAt === undefined) {
      processedData.updatedAt = new Date();
    }

    return processedData;
  }

  public filterHiddenFields(
    collection: ICollection, 
    data: any, 
    options: { localeContext: any; rawLocalized: boolean }
  ) {
    if (!data) return data;

    if (Array.isArray(data)) {
      return data.map((item) => this.filterHiddenFields(collection, item, options));
    }

    const transformed = this.localization.transformOutgoingData(collection, data, options);
    const { passwords, arrays } = DataProcessorService.outgoingShape(collection);

    // SECURITY: `type: 'password'` fields (e.g. the users bcrypt hash) NEVER leave the API —
    // unconditionally stripped from every outgoing document (reads AND the echoed doc in write
    // responses), regardless of admin.hidden or access flags. This is a data-type rule: a stored
    // secret/credential hash is write-only through this layer.
    for (const name of passwords) delete transformed[name];

    // Ensure array fields are parsed if they came back as strings
    for (const name of arrays) {
      const value = transformed[name];
      if (typeof value === 'string') {
        try {
          transformed[name] = JSON.parse(value);
        } catch {
          transformed[name] = [];
        }
      }
    }

    return transformed;
  }

  /**
   * Which of a collection's fields are passwords and which are arrays, worked out once per field list
   * rather than for every field of every row: on a list read it was a fifth of the api's time. Keyed by
   * the `fields` array itself and its length, so a collection registered again, or a field pushed onto
   * its list, is read afresh — a password field must never be missed.
   * `FieldType.resolve(...)`, not `field.type === FieldType.PASSWORD`: a collection may declare its field
   * type as the raw literal (`type: 'password'`) — every plugin does — and a raw string is never
   * reference-equal to the Enum member, so the direct comparison silently strips nothing.
   */
  private static outgoingShape(collection: ICollection): { count: number; passwords: string[]; arrays: string[] } {
    const fields = collection.fields as object;
    let shape = DataProcessorService.shapes.get(fields);
    if (!shape || shape.count !== collection.fields.length) {
      shape = {
        count: collection.fields.length,
        passwords: collection.fields.filter((field) => FieldType.resolve(field.type) === FieldType.PASSWORD).map((field) => field.name),
        arrays: collection.fields.filter((field) => FieldType.resolve(field.type) === FieldType.ARRAY).map((field) => field.name),
      };
      DataProcessorService.shapes.set(fields, shape);
    }
    return shape;
  }

  private static readonly shapes = new WeakMap<object, { count: number; passwords: string[]; arrays: string[] }>();
}
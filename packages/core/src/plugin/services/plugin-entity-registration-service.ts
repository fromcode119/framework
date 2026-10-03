import { FieldPosition } from '@core/enums/field-position.enum';
import { NamingStrategy } from '@fromcode119/database/naming-strategy';
import { PhysicalTableNameUtils } from '@fromcode119/database/physical-table-name-utils';
import { CollectionLabelUtils } from '@core/collections/collection-label-utils';
import { CollectionArchive } from '@core/collections/collection-archive';
import type { ICollection } from '@core/collections/interfaces/collection.interface';
import type { IField } from '@core/interfaces/field.interface';
import type { ICollectionInput } from '@core/collections/interfaces/collection-input.interface';
import type { IFieldInput } from '@core/interfaces/field-input.interface';
import type { IPluginEntityRegistrationResult } from '@core/plugin/services/interfaces/plugin-entity-registration-result.interface';
import { FieldType } from '@core/enums/field-type.enum';

export class PluginEntityRegistrationService {
  normalizeForPlugin(collection: ICollectionInput, pluginSlug: string): IPluginEntityRegistrationResult {
    const inputSlug = collection.slug;
    const normalizedPluginSlug = NamingStrategy.toSnakeIdentifier(pluginSlug);
    const tablePrefix = PhysicalTableNameUtils.createPluginPrefix(normalizedPluginSlug);
    const cleanInputSlug = inputSlug.startsWith(`${pluginSlug}-`)
      ? inputSlug.slice(pluginSlug.length + 1)
      : inputSlug;
    const tableSuffixSource = inputSlug.startsWith(tablePrefix)
      ? inputSlug.replace(tablePrefix, '')
      : cleanInputSlug;
    const normalizedTableSuffix = NamingStrategy.toSnakeIdentifier(tableSuffixSource);
    const physicalSlug = PhysicalTableNameUtils.create(pluginSlug, normalizedTableSuffix);
    const shortSlug = collection.shortSlug || (inputSlug.startsWith(tablePrefix) ? inputSlug.replace(tablePrefix, '') : cleanInputSlug);
    const cleanedSlug = (inputSlug.startsWith(pluginSlug) && inputSlug !== pluginSlug) || PhysicalTableNameUtils.hasPlatformPrefix(inputSlug);

    return {
      cleanedSlug,
      physicalSlug,
      shortSlug,
      collection: {
        ...collection,
        access: collection.access ? { ...collection.access } : undefined,
        hooks: this.cloneHooks(collection),
        admin: this.cloneAdmin(collection),
        fields: this.cloneFields(collection.fields || []),
        indexes: collection.indexes
          ? collection.indexes.map((index) => ({ ...index, fields: [...index.fields] }))
          : undefined,
        inputAliases: collection.inputAliases
          ? collection.inputAliases.map((alias) => ({ ...alias, from: [...alias.from] }))
          : undefined,
        derivedFields: collection.derivedFields
          ? collection.derivedFields.map((field) => ({
            ...field,
            dependsOn: field.dependsOn ? [...field.dependsOn] : undefined,
          }))
          : undefined,
        api: collection.api ? { ...collection.api } : undefined,
        adminLayout: collection.adminLayout
          ? {
            sections: collection.adminLayout.sections
              ? collection.adminLayout.sections.map((section) => ({ ...section }))
              : undefined,
            tabs: collection.adminLayout.tabs
              ? collection.adminLayout.tabs.map((tab) => ({ ...tab }))
              : undefined,
          }
          : undefined,
        slug: physicalSlug,
        shortSlug,
        unprefixedSlug: inputSlug,
        pluginSlug,
        displayName: CollectionLabelUtils.labelFor(collection, shortSlug),
      },
    };
  }

  applyFrameworkFields(collection: ICollection): ICollection {
    const nextCollection = { ...collection, fields: this.cloneFields(collection.fields || []) };

    if (nextCollection.workflow) {
      this.ensureWorkflowFields(nextCollection);
    }

    if (nextCollection.fields.find((field: IField) => field.name === 'slug')) {
      this.ensurePermalinkFields(nextCollection);
    }

    if (CollectionArchive.isArchivable(nextCollection)) {
      this.ensureArchiveFields(nextCollection);
    }

    return nextCollection;
  }

  /**
   * The OWNING plugin registered its collection again — its process was swapped for new code. Its
   * declared fields replace the definitions held since boot (a field turned read-only, relabelled,
   * given new options), and new ones are added. Fields it no longer declares stay until a restart:
   * another plugin may have extended this collection, and dropping a field here would hide its data.
   * Without this, an in-place update kept every changed field definition until the api restarted.
   */
  refreshOwnCollectionFields(existing: ICollection, incoming: ICollection): void {
    const next = [...existing.fields];
    const indexByName = new Map(next.map((field: IField, index: number) => [field.name, index]));
    for (const field of incoming.fields) {
      const index = indexByName.get(field.name);
      if (index === undefined) next.push(field);
      else next[index] = field;
    }
    // A NEW array, not the old one edited: caches keyed by the fields array (the data processor's
    // password/array field lists) recompute only for a new identity or length — a field turned into
    // a password in place would otherwise keep being returned raw.
    existing.fields = next;
  }

  mergeCollectionFields(existing: ICollection, incoming: ICollection): void {
    const fieldNames = new Set(existing.fields.map((field: IField) => field.name));
    for (const field of incoming.fields) {
      if (!fieldNames.has(field.name)) {
        existing.fields.push(field);
      }
    }
  }

  private ensureArchiveFields(collection: ICollection): void {
    for (const field of CollectionArchive.fields()) {
      if (!collection.fields.find((existing) => existing.name === field.name)) {
        collection.fields.push(field);
      }
    }
  }

  private ensureWorkflowFields(collection: ICollection): void {
    if (!collection.fields.find((field) => field.name === 'status')) {
      collection.fields.push({
        name: 'status',
        type: FieldType.SELECT,
        label: 'Status',
        defaultValue: 'draft',
        options: [
          { label: 'Draft', value: 'draft' },
          { label: 'In Review', value: 'review' },
          { label: 'Published', value: 'published' },
        ],
        admin: { position: FieldPosition.SIDEBAR, section: 'Review Process' },
      } as IField);
    }

    if (!collection.fields.find((field) => field.name === 'publishedAt')) {
      collection.fields.push({
        name: 'publishedAt',
        type: FieldType.DATETIME,
        label: 'Published Date',
        admin: { position: FieldPosition.SIDEBAR, section: 'Review Process' },
      } as IField);
    }
  }

  /**
   * Injects the permalink override fields — but ONLY for collections the admin will actually show a
   * permalink panel for.
   *
   * The admin decides that with `supportsPreview()`: a slug field AND `admin.preview !== false`.
   * Injection used to check the slug alone, so 17 collections that opt out of preview (rate tables,
   * delivery zones, payment methods, form definitions, …) received a `customPermalink`
   * — `unique: true`, so a real unique index — plus `disablePermalink`, with no UI anywhere to reach
   * either. Matching the admin's rule here means a permalink field can no longer exist without a way
   * to set it. Checked before changing: NO row in ANY table has a `custom_permalink` value, so
   * nothing depends on the fields these collections were being given.
   */
  private ensurePermalinkFields(collection: ICollection): void {
    if ((collection.admin as { preview?: boolean } | undefined)?.preview === false) {
      return;
    }

    if (!collection.fields.find((field) => field.name === 'customPermalink')) {
      collection.fields.push({
        name: 'customPermalink',
        type: FieldType.TEXT,
        unique: true,
        admin: { hidden: true },
      } as IField);
    }

    if (!collection.fields.find((field) => field.name === 'disablePermalink')) {
      collection.fields.push({
        name: 'disablePermalink',
        type: FieldType.CHECKBOX,
        defaultValue: false,
        admin: { hidden: true },
      } as IField);
    }
  }

  private cloneFields(fields: readonly IFieldInput[]): IField[] {
    return [...fields].map((field) => {
      const mutableField = { ...field } as IField;
      mutableField.options = Array.isArray(field.options)
        ? field.options.map((option) => (option && typeof option === 'object'
          ? { ...option, value: PluginEntityRegistrationService.storedValue((option as { value?: unknown }).value) }
          : option))
        : field.options as IField['options'];
      // Only an option-bearing field's default is an option value; a json field's default object is data.
      if (Array.isArray(field.options) && field.defaultValue !== undefined) mutableField.defaultValue = PluginEntityRegistrationService.storedValue(field.defaultValue) as IField['defaultValue'];
      mutableField.relationTo = Array.isArray(field.relationTo)
        ? [...field.relationTo]
        : field.relationTo as IField['relationTo'];
      mutableField.fields = Array.isArray(field.fields)
        ? this.cloneFields(field.fields)
        : field.fields as IField['fields'];
      mutableField.admin = field.admin ? { ...field.admin } : field.admin as IField['admin'];
      return mutableField;
    });
  }

  /**
   * The value a select stores, from what a plugin declared.
   *
   * Plugins declare options with Enum members (`value: PayoutStatus.PENDING`). An isolated plugin's
   * declaration crosses the process boundary as structured data, which keeps a member's fields but not
   * its class, so it arrived as `{ value: 'pending', label: 'Pending', … }`. A list then matched no
   * stored value and printed it raw, the console found no translation for it, and the editor's dropdown
   * could not show the stored status. A member — hydrated or not — becomes the string it stores.
   */
  static storedValue(value: unknown): unknown {
    if (value && typeof value === 'object' && !Array.isArray(value) && typeof (value as { value?: unknown }).value === 'string') {
      return (value as { value: string }).value;
    }
    return value;
  }

  private cloneHooks(collection: ICollectionInput): ICollection['hooks'] {
    if (!collection.hooks) {
      return undefined;
    }

    return {
      beforeChange: collection.hooks.beforeChange ? [...collection.hooks.beforeChange] : undefined,
      afterChange: collection.hooks.afterChange ? [...collection.hooks.afterChange] : undefined,
      beforeDelete: collection.hooks.beforeDelete ? [...collection.hooks.beforeDelete] : undefined,
      afterDelete: collection.hooks.afterDelete ? [...collection.hooks.afterDelete] : undefined,
    };
  }

  private cloneAdmin(collection: ICollectionInput): ICollection['admin'] {
    if (!collection.admin) {
      return undefined;
    }

    return {
      ...collection.admin,
      defaultColumns: collection.admin.defaultColumns ? [...collection.admin.defaultColumns] : undefined,
      tabs: collection.admin.tabs ? collection.admin.tabs.map((tab) => ({ ...tab })) : undefined,
      sections: collection.admin.sections ? collection.admin.sections.map((section) => ({ ...section })) : undefined,
    };
  }
}

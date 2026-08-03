import { FieldPosition } from '@core/enums/field-position.enum';
import { NamingStrategy } from '@fromcode119/database/naming-strategy';
import { PhysicalTableNameUtils } from '@fromcode119/database/physical-table-name-utils';
import type { ICollection } from '@core/interfaces/collection.interface';
import type { IField } from '@core/interfaces/field.interface';
import type { ICollectionInput } from '@core/interfaces/collection-input.interface';
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
        displayName: collection.displayName || shortSlug.charAt(0).toUpperCase() + shortSlug.slice(1),
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

    return nextCollection;
  }

  mergeCollectionFields(existing: ICollection, incoming: ICollection): void {
    const fieldNames = new Set(existing.fields.map((field: IField) => field.name));
    for (const field of incoming.fields) {
      if (!fieldNames.has(field.name)) {
        existing.fields.push(field);
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

  private ensurePermalinkFields(collection: ICollection): void {
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
        ? field.options.map((option) => ({ ...option }))
        : field.options as IField['options'];
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

import { BaseEntity } from '@core/base/base-entity';
import type { ICollection } from '@core/interfaces/collection.interface';
import type { IField } from '@core/interfaces/field.interface';
import type { IEntityFieldConfig } from '@core/interfaces/entity-field-config.interface';
import { FieldType } from '@core/enums/field-type.enum';

export abstract class BaseEntityCollection<TRecord extends object> extends BaseEntity<TRecord> {
  abstract readonly slug: string;
  readonly displayName?: string;

  collectionDefinition(): ICollection {
    return {
      slug: this.slug,
      displayName: this.displayName,
      fields: Object.entries(this.entityFields()).map(([name, config]) => this.toCollectionField(name, config)),
    };
  }

  private toCollectionField(name: string, config: IEntityFieldConfig): IField {
    return {
      name,
      type: this.toCollectionFieldType(config),
      label: config.label,
      required: config.required,
      unique: config.unique,
      defaultValue: config.default,
      inputAliases: config.from,
      options: config.options,
      relationTo: config.relationTo,
      hasMany: config.hasMany,
      admin: config.admin,
    };
  }

  private toCollectionFieldType(config: IEntityFieldConfig): IField['type'] {
    if (config.type === 'string') return FieldType.TEXT;
    if (config.type === 'object') return FieldType.JSON;
    if (config.type === 'enum') return FieldType.SELECT;
    if (config.type === 'raw') return FieldType.JSON;
    // `config.type` may already name a FieldType ('number', 'date', …) or be an entity-only coercion
    // tag ('relationId', 'isoDate', …). Hydrate the former so downstream enum comparisons work; pass
    // the latter through untouched, exactly as the old blanket cast did.
    const asFieldType = FieldType.fromValue(String(config.type ?? '').trim()) as FieldType | undefined;
    return asFieldType ?? (config.type as IField['type']);
  }
}

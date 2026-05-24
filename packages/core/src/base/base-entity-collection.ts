import { BaseEntity } from './base-entity';
import type { Collection, Field } from '../types/schema.interfaces';
import type { EntityFieldConfig } from '../types/entity-field-config.interfaces';
import type { EntityFieldsConfig } from '../types/entity-field-config.types';

export abstract class BaseEntityCollection<TRecord extends object> extends BaseEntity<TRecord> {
  abstract readonly slug: string;
  readonly displayName?: string;

  collectionDefinition(): Collection {
    return {
      slug: this.slug,
      displayName: this.displayName,
      fields: Object.entries(this.entityFields()).map(([name, config]) => this.toCollectionField(name, config)),
    };
  }

  private toCollectionField(name: string, config: EntityFieldConfig): Field {
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

  private toCollectionFieldType(config: EntityFieldConfig): Field['type'] {
    if (config.type === 'string') return 'text';
    if (config.type === 'object') return 'json';
    if (config.type === 'enum') return 'select';
    if (config.type === 'raw') return 'json';
    return config.type as Field['type'];
  }
}

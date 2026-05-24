import type { EntityFieldConfig } from '../types/entity-field-config.interfaces';
import type { EntityFieldsConfig } from '../types/entity-field-config.types';
import type { EntityColumnMetadata } from '../types/entity-column.interfaces';

export class EntityMetadataService {
  private static readonly registry = new WeakMap<Function, EntityColumnMetadata[]>();

  static defineField(target: object, propertyKey: string | symbol, config: EntityFieldConfig): void {
    const constructor = target.constructor;
    const fields = this.registry.get(constructor) || [];
    const name = String(propertyKey);
    const index = fields.findIndex((field) => field.name === name);
    const metadata = { name, config };
    if (index >= 0) {
      fields[index] = metadata;
    } else {
      fields.push(metadata);
    }
    this.registry.set(constructor, fields);
  }

  static resolveFields(instanceOrConstructor: object | Function): EntityFieldsConfig {
    const constructor = typeof instanceOrConstructor === 'function'
      ? instanceOrConstructor
      : instanceOrConstructor.constructor;
    const fields: EntityFieldsConfig = {};

    for (const metadata of this.resolveMetadataChain(constructor)) {
      fields[metadata.name] = metadata.config;
    }

    return fields;
  }

  private static resolveMetadataChain(constructor: Function): EntityColumnMetadata[] {
    const constructors: Function[] = [];
    let current: Function | null = constructor;

    while (current && current !== Object) {
      constructors.unshift(current);
      const prototype = Object.getPrototypeOf(current.prototype);
      current = prototype?.constructor || null;
    }

    return constructors.flatMap((entry) => this.registry.get(entry) || []);
  }
}

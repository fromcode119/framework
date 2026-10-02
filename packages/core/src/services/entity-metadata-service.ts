import type { IEntityFieldConfig } from '@core/entity/interfaces/entity-field-config.interface';
import type { IEntityFieldsConfig } from '@core/entity/interfaces/entity-fields-config.interface';
import type { IEntityColumnMetadata } from '@core/entity/interfaces/entity-column-metadata.interface';

export class EntityMetadataService {
  private static readonly registry = new WeakMap<Function, IEntityColumnMetadata[]>();
  /**
   * Each class's resolved fields, kept: every mapped row asked for them, and walking the prototype
   * chain to rebuild the same object was a measurable share of a plugin listing. Declaring a field (at
   * class definition) moves `generation`, so a class declared later never reuses an older answer.
   */
  private static readonly resolved = new WeakMap<Function, { generation: number; fields: IEntityFieldsConfig }>();
  private static generation = 0;

  static defineField(target: object, propertyKey: string | symbol, config: IEntityFieldConfig): void {
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
    EntityMetadataService.generation += 1;
  }

  static resolveFields(instanceOrConstructor: object | Function): IEntityFieldsConfig {
    const constructor = typeof instanceOrConstructor === 'function'
      ? instanceOrConstructor
      : instanceOrConstructor.constructor;
    const known = this.resolved.get(constructor);
    if (known && known.generation === EntityMetadataService.generation) return known.fields;
    const fields: IEntityFieldsConfig = {};

    for (const metadata of this.resolveMetadataChain(constructor)) {
      fields[metadata.name] = metadata.config;
    }

    this.resolved.set(constructor, { generation: EntityMetadataService.generation, fields });
    return fields;
  }

  private static resolveMetadataChain(constructor: Function): IEntityColumnMetadata[] {
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

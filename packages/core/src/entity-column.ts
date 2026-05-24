import { EntityMetadataService } from './services/entity-metadata-service';
import type { EntityFieldConfig } from './types/entity-field-config.interfaces';
import type { EntityColumnDecorator, EntityColumnOptions } from './types/entity-column.types';

export class EntityColumn {
  static field(config: EntityFieldConfig): EntityColumnDecorator {
    return (target: object, propertyKey: string | symbol): void => {
      EntityMetadataService.defineField(target, propertyKey, config);
    };
  }

  static text(options: EntityColumnOptions = {}): EntityColumnDecorator {
    return this.field({ ...options, type: 'string' });
  }

  static string(options: EntityColumnOptions = {}): EntityColumnDecorator {
    return this.text(options);
  }

  static number(options: EntityColumnOptions = {}): EntityColumnDecorator {
    return this.field({ ...options, type: 'number' });
  }

  static boolean(options: EntityColumnOptions = {}): EntityColumnDecorator {
    return this.field({ ...options, type: 'boolean' });
  }

  static array(options: EntityColumnOptions = {}): EntityColumnDecorator {
    return this.field({ ...options, type: 'array' });
  }

  static object(options: EntityColumnOptions = {}): EntityColumnDecorator {
    return this.field({ ...options, type: 'object' });
  }

  static raw(options: EntityColumnOptions = {}): EntityColumnDecorator {
    return this.field({ ...options, type: 'raw' });
  }

  static enum(options: EntityColumnOptions = {}): EntityColumnDecorator {
    return this.field({ ...options, type: 'enum' });
  }

  static relationId(options: EntityColumnOptions = {}): EntityColumnDecorator {
    return this.field({ ...options, type: 'relationId' });
  }

  static relationship(options: EntityColumnOptions = {}): EntityColumnDecorator {
    return this.field({ ...options, type: 'relationship' });
  }

  static upload(options: EntityColumnOptions = {}): EntityColumnDecorator {
    return this.field({ ...options, type: 'upload' });
  }

  static json(options: EntityColumnOptions = {}): EntityColumnDecorator {
    return this.field({ ...options, type: 'json' });
  }

  static group(options: EntityColumnOptions = {}): EntityColumnDecorator {
    return this.field({ ...options, type: 'group' });
  }

  static richText(options: EntityColumnOptions = {}): EntityColumnDecorator {
    return this.field({ ...options, type: 'richText' });
  }

  static date(options: EntityColumnOptions = {}): EntityColumnDecorator {
    return this.field({ ...options, type: 'date' });
  }

  static isoDate(options: EntityColumnOptions = {}): EntityColumnDecorator {
    return this.field({ ...options, type: 'isoDate' });
  }

  static isoDateOrNow(options: EntityColumnOptions = {}): EntityColumnDecorator {
    return this.field({ ...options, type: 'isoDateOrNow' });
  }
}

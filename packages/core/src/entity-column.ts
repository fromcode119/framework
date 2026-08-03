import { EntityMetadataService } from '@core/services/entity-metadata-service';
import type { IEntityFieldConfig } from '@core/interfaces/entity-field-config.interface';
import type { IEntityColumnDecorator } from '@core/interfaces/entity-column-decorator.interface';
import type { IEntityColumnOptions } from '@core/interfaces/entity-column-options.interface';

export class EntityColumn {
  static field(config: IEntityFieldConfig): IEntityColumnDecorator {
    return (target: object, propertyKey: string | symbol): void => {
      EntityMetadataService.defineField(target, propertyKey, config);
    };
  }

  static text(options: IEntityColumnOptions = {}): IEntityColumnDecorator {
    return this.field({ ...options, type: 'string' });
  }

  static string(options: IEntityColumnOptions = {}): IEntityColumnDecorator {
    return this.text(options);
  }

  static number(options: IEntityColumnOptions = {}): IEntityColumnDecorator {
    return this.field({ ...options, type: 'number' });
  }

  static boolean(options: IEntityColumnOptions = {}): IEntityColumnDecorator {
    return this.field({ ...options, type: 'boolean' });
  }

  static array(options: IEntityColumnOptions = {}): IEntityColumnDecorator {
    return this.field({ ...options, type: 'array' });
  }

  static object(options: IEntityColumnOptions = {}): IEntityColumnDecorator {
    return this.field({ ...options, type: 'object' });
  }

  static raw(options: IEntityColumnOptions = {}): IEntityColumnDecorator {
    return this.field({ ...options, type: 'raw' });
  }

  static enum(options: IEntityColumnOptions = {}): IEntityColumnDecorator {
    return this.field({ ...options, type: 'enum' });
  }

  static relationId(options: IEntityColumnOptions = {}): IEntityColumnDecorator {
    return this.field({ ...options, type: 'relationId' });
  }

  static relationship(options: IEntityColumnOptions = {}): IEntityColumnDecorator {
    return this.field({ ...options, type: 'relationship' });
  }

  static upload(options: IEntityColumnOptions = {}): IEntityColumnDecorator {
    return this.field({ ...options, type: 'upload' });
  }

  static json(options: IEntityColumnOptions = {}): IEntityColumnDecorator {
    return this.field({ ...options, type: 'json' });
  }

  static group(options: IEntityColumnOptions = {}): IEntityColumnDecorator {
    return this.field({ ...options, type: 'group' });
  }

  static richText(options: IEntityColumnOptions = {}): IEntityColumnDecorator {
    return this.field({ ...options, type: 'richText' });
  }

  static date(options: IEntityColumnOptions = {}): IEntityColumnDecorator {
    return this.field({ ...options, type: 'date' });
  }

  static isoDate(options: IEntityColumnOptions = {}): IEntityColumnDecorator {
    return this.field({ ...options, type: 'isoDate' });
  }

  static isoDateOrNow(options: IEntityColumnOptions = {}): IEntityColumnDecorator {
    return this.field({ ...options, type: 'isoDateOrNow' });
  }
}

import type { IEntityFieldConfig } from '@core/interfaces/entity-field-config.interface';

/**
 * Field configuration minus `type`, which `@EntityColumn` derives from the decorated property instead of
 * taking as an option.
 */
export interface IEntityColumnOptions extends Omit<IEntityFieldConfig, 'type'> {}

import type { EntityFieldConfig } from './entity-field-config.interfaces';

export type EntityFieldTransform =
  | 'trim'
  | 'lowercase'
  | 'uppercase'
  | 'round2'
  | 'min0'
  | 'currencyObject'
  | 'stringArray';

export type EntityFieldsConfig = Record<string, EntityFieldConfig>;

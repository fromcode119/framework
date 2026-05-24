import type { EntityFieldConfig } from './entity-field-config.interfaces';

export type EntityColumnDecorator = (target: object, propertyKey: string | symbol) => void;
export type EntityColumnOptions = Omit<EntityFieldConfig, 'type'>;

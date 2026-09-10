/**
 * What `@EntityColumn(...)` returns — a property decorator.
 *
 * A call signature has no class form, so this stays an `interface`.
 */
export interface IEntityColumnDecorator {
  (target: object, propertyKey: string | symbol): void;
}

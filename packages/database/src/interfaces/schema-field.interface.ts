/**
 * Minimal schema interfaces to avoid circular dependency with core
 */
export interface ISchemaField {
  name: string;
  type: string;
  required?: boolean;
  unique?: boolean;
  defaultValue?: any;
}

import type { ISchemaField } from '@database/interfaces/schema-field.interface';

export interface ISchemaCollection {
  slug: string;
  fields: ISchemaField[];
}

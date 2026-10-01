import type { SqlColumn } from '@database/sql/sql-column';
import type { SqlColumnBuilder } from '@database/sql/sql-column-builder';

/**
 * A declared table: its columns are its own properties (`Schema.users.email`), and its name, schema and
 * column map sit under symbols so that no column — `name`, say — can collide with them.
 */
export class SqlTable {
  static readonly NAME = Symbol.for('fromcode.sql.table.name');
  static readonly SCHEMA = Symbol.for('fromcode.sql.table.schema');
  static readonly COLUMNS = Symbol.for('fromcode.sql.table.columns');

  static define<T extends Record<string, SqlColumnBuilder>>(name: string, builders: T, schema?: string): SqlTable & { [K in keyof T]: SqlColumn } {
    const table: any = new SqlTable();
    const columns: Record<string, SqlColumn> = {};
    for (const [key, builder] of Object.entries(builders)) {
      const column = builder.build(key);
      column.table = table;
      columns[key] = column;
      table[key] = column;
    }
    table[SqlTable.NAME] = name;
    table[SqlTable.SCHEMA] = schema;
    table[SqlTable.COLUMNS] = columns;
    return table;
  }

  static nameOf(table: object): string {
    return (table as any)[SqlTable.NAME];
  }

  static schemaOf(table: object): string | undefined {
    return (table as any)[SqlTable.SCHEMA];
  }

  /** `{ fieldName: column }`, in declaration order. */
  static columnsOf(table: object): Record<string, SqlColumn> {
    return (table as any)[SqlTable.COLUMNS];
  }
}

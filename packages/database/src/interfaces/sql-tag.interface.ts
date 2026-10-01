import type { SqlFragment } from '@database/sql/sql-fragment';
import type { SqlName } from '@database/sql/sql-name';
import type { SqlParam } from '@database/sql/sql-param';
import type { ISqlValueEncoder } from '@database/interfaces/sql-value-encoder.interface';

/** The `sql` template tag, and its helpers for SQL that a template cannot write. */
export interface ISqlTag {
  (strings: TemplateStringsArray, ...values: unknown[]): SqlFragment;
  /** Literal text, never bound — only ever for text the code itself wrote. */
  raw(text: string): SqlFragment;
  identifier(name: string): SqlName;
  join(chunks: unknown[], separator?: unknown): SqlFragment;
  param(value: unknown, encoder?: ISqlValueEncoder): SqlParam;
  empty(): SqlFragment;
  fromList(chunks: unknown[]): SqlFragment;
}

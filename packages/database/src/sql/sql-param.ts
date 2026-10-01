import type { ISqlValueEncoder } from '@database/interfaces/sql-value-encoder.interface';

/** A bound value. `encoder` (a column) turns it into what the driver takes; null stays null. */
export class SqlParam {
  constructor(readonly value: unknown, readonly encoder?: ISqlValueEncoder) {}
}

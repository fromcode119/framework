/** An identifier — a table, column or index name — quoted by the dialect that renders it. */
export class SqlName {
  constructor(readonly value: string) {}
}

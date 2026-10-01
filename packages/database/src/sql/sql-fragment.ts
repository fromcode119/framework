/**
 * A piece of SQL: text, identifiers, tables, columns, bound values and other fragments, in order.
 * Nothing is rendered until a dialect's `SqlRenderer` does it, so one fragment serves every dialect.
 */
export class SqlFragment {
  constructor(readonly chunks: unknown[]) {}

  /** Adds `other`'s chunks to the end of this fragment, and answers this fragment. */
  append(other: SqlFragment): this {
    this.chunks.push(...other.chunks);
    return this;
  }

  getSQL(): SqlFragment {
    return this;
  }
}

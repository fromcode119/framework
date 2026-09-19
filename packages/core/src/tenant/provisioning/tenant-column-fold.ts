/**
 * One destination column that ABSORBS columns an older schema used for the same thing.
 *
 * Declared by the collection that owns the field (`IField.legacyColumns`) and read generically here,
 * exactly as a relationship is: the framework never knows which plugin, field or column is involved,
 * only that a field said "these older columns are mine".
 */
export class TenantColumnFold {
  constructor(
    /** The destination column the older ones fold into. */
    readonly column: string,
    /** Archive column → the key it becomes inside `column`'s value. */
    readonly legacy: Record<string, string>,
  ) {}

  /** The archive columns this fold claims. */
  get sources(): string[] {
    return Object.keys(this.legacy);
  }
}

import { Enum } from '@fromcode119/reactor';

/** Sort direction for repository queries. */
export class SortOrder extends Enum {
  static readonly ASC = new SortOrder('asc');
  static readonly DESC = new SortOrder('desc');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a raw string to a member; defaults to ASC. */
  static resolve(value: unknown): SortOrder {
    if (value instanceof SortOrder) return value;
    const found = SortOrder.fromValue(String(value ?? '').trim().toLowerCase());
    return (found as SortOrder | undefined) ?? SortOrder.ASC;
  }
}

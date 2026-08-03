import { Enum } from '@fromcode119/reactor';

/** Control type of a datasource filter. */
export class FilterKind extends Enum {
  static readonly SELECT = new FilterKind('select');
  static readonly TEXT = new FilterKind('text');
  static readonly NUMBER = new FilterKind('number');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a raw plugin/wire string to a member; defaults to TEXT. */
  static resolve(value: unknown): FilterKind {
    if (value instanceof FilterKind) return value;
    const found = FilterKind.fromValue(String(value ?? '').trim());
    return (found as FilterKind | undefined) ?? FilterKind.TEXT;
  }
}

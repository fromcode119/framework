import { Enum } from '@fromcode119/react-class-components/lang';

/** How a declared read-route filter compares a query value with the collection field it names. */
export class ReadRouteMatch extends Enum {
  /** The field equals the value. */
  static readonly EQUALS = new ReadRouteMatch('equals');
  /** The field — a JSON array — holds the value. */
  static readonly CONTAINS = new ReadRouteMatch('contains');

  private constructor(value: string) {
    super(value);
  }

  /** The member a manifest names; anything else is an exact match, the narrowest reading. */
  static resolve(value: unknown): ReadRouteMatch {
    if (value instanceof ReadRouteMatch) return value;
    return (ReadRouteMatch.fromValue(String(value ?? '').trim().toLowerCase()) as ReadRouteMatch | undefined) ?? ReadRouteMatch.EQUALS;
  }
}

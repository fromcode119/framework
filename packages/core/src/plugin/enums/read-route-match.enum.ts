import { Enum } from '@fromcode119/react-class-components/lang';

/** How a declared read-route filter compares a query value with the collection field it names. */
export class ReadRouteMatch extends Enum {
  /** The field equals the value. */
  static readonly EQUALS = new ReadRouteMatch('equals');
  /** The field — a JSON array — holds the value. */
  static readonly CONTAINS = new ReadRouteMatch('contains');
  /** The field is a number at least the value. */
  static readonly MINIMUM = new ReadRouteMatch('min');
  /** The field is a number at most the value. */
  static readonly MAXIMUM = new ReadRouteMatch('max');
  /** The field equals one of a list — `?slugs=a,b` or `?slugs=a&slugs=b`, read the way a plugin reads a list. */
  static readonly IN = new ReadRouteMatch('in');
  /** A switch: when the value reads as true the field must be true; any other value asks nothing. */
  static readonly FLAG = new ReadRouteMatch('flag');

  private constructor(value: string) {
    super(value);
  }

  /** The member a manifest names; anything else is an exact match, the narrowest reading. */
  static resolve(value: unknown): ReadRouteMatch {
    if (value instanceof ReadRouteMatch) return value;
    return (ReadRouteMatch.fromValue(String(value ?? '').trim().toLowerCase()) as ReadRouteMatch | undefined) ?? ReadRouteMatch.EQUALS;
  }
}

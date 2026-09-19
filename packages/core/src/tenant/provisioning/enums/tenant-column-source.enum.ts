import { Enum } from '@fromcode119/react-class-components';

/**
 * How a reference between two tables was DISCOVERED.
 *
 * `FK` is a real foreign key the database itself enforces. `SCHEMA` is a relationship a collection
 * declared, which the database knows nothing about — the id lives in a JSON column and only the
 * schema says what it points at. `POLYMORPHIC` names no target at all until a row is in hand: a
 * sibling column on that row carries the table name. The remap must follow all three, and it reports
 * them differently: a declared reference can be wrong in ways a constraint cannot.
 */
export class TenantColumnSource extends Enum {
  /** A database foreign key. */
  static readonly FK = new TenantColumnSource('fk');

  /** A relationship declared by a collection schema. */
  static readonly SCHEMA = new TenantColumnSource('schema');

  /** A pointer whose target table is named per row by a sibling column — see {@link TenantPolymorphicReferences}. */
  static readonly POLYMORPHIC = new TenantColumnSource('polymorphic');

  private constructor(value: string) {
    super(value);
  }
}

/**
 * Base for method-bearing, type-safe enums — the OOP enum TypeScript's `enum` can't be.
 * Subclasses declare their members as `static readonly` instances and can attach fields and
 * methods, exactly like a PHP 8.1 / Java enum:
 *
 *   export class Status extends Enum {
 *     static readonly DRAFT     = new Status('draft', 'grey');
 *     static readonly PUBLISHED = new Status('published', 'green');
 *     static readonly ARCHIVED  = new Status('archived', 'red');
 *     private constructor(value: string, readonly color: string) { super(value); }
 *   }
 *
 *   Status.PUBLISHED.color        // 'green'
 *   Status.values()               // [DRAFT, PUBLISHED, ARCHIVED]
 *   Status.fromValue('draft')     // Status.DRAFT
 *   String(Status.DRAFT)          // 'draft'  (serialises to its value)
 *
 * Members self-register on construction, so `values()` / `fromValue()` work with no boilerplate.
 */
export abstract class Enum {
  private static readonly registry = new Map<Function, Enum[]>();

  protected constructor(readonly value: string) {
    const members = Enum.registry.get(this.constructor) ?? [];
    members.push(this);
    Enum.registry.set(this.constructor, members);
  }

  toString(): string {
    return this.value;
  }

  toJSON(): string {
    return this.value;
  }

  // `this` is typed structurally (the class object carrying `prototype: T`), NOT as `new (...) => T`, so
  // enums with a PRIVATE constructor — the idiomatic form — still type-check when calling these statics.
  /** All declared members of the concrete enum, in declaration order. */
  static values<T extends Enum>(this: Function & { prototype: T }): readonly T[] {
    return (Enum.registry.get(this) ?? []) as T[];
  }

  /** The member whose `value` matches, or `undefined`. Linear scan — enums are small; a Map cache measured
   *  SLOWER for the typical <10-member enum (Map overhead > a 4-item find). */
  static fromValue<T extends Enum>(this: Function & { prototype: T }, value: string): T | undefined {
    return ((Enum.registry.get(this) ?? []) as T[]).find((member) => member.value === value);
  }

  /** True when `value` is a known member value. */
  static has<T extends Enum>(this: Function & { prototype: T }, value: string): boolean {
    return ((Enum.registry.get(this) ?? []) as T[]).some((member) => member.value === value);
  }
}

/**
 * `Protocol` — a behavioral contract as a first-class reactor primitive: an interface that CAN carry
 * implementation. A plain TS `interface` is the right tool for a zero-cost STRUCTURAL type contract; reach for
 * `Protocol` when the contract needs the two things a TS interface cannot do:
 *   1. DEFAULT methods (a trait, like Java-8 default interface methods) that implementers inherit; and
 *   2. a runtime `satisfiedBy` check ("does this object meet the contract?").
 *
 * Extend it to declare `abstract` contract members plus concrete default methods. A class inherits the
 * defaults either by `extends`ing the protocol directly, or — when it already extends something (a `Reactor`
 * component, a data class) — by mixing it in with `implement(Base, ThisProtocol)`.
 *
 *   export class Comparable extends Protocol {
 *     abstract compareTo(other: this): number;             // the contract
 *     lessThan(other: this): boolean { return this.compareTo(other) < 0; }   // default method — inherited free
 *     max(other: this): this { return this.compareTo(other) >= 0 ? this : other; }
 *   }
 *
 *   class Money extends Comparable { compareTo(o: this): number { return this.cents - o.cents; } }
 *   new Money(500).lessThan(new Money(900));   // true — default method, no boilerplate
 *   Comparable.satisfiedBy(x, 'compareTo');    // runtime contract check
 */
export abstract class Protocol {
  /** Duck-typed runtime check: does `obj` provide every named member (field or method)? */
  static satisfiedBy(obj: unknown, ...members: string[]): boolean {
    if (obj === null || obj === undefined) return false;
    const record = obj as Record<string, unknown>;
    return members.every((member) => record[member] !== undefined);
  }
}

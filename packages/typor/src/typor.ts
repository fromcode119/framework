import type { IConstructor } from './interfaces/constructor.interface';

/**
 * Extends TypeScript for real OOP.
 *
 * TypeScript classes are SINGLE-inheritance: an `extends` clause naming two bases is a syntax error, which is the only
 * reason a composed data shape ever had to stay an `interface`. `Typor.mixin` removes that limit — it
 * composes any number of bases into one class, with the combined instance AND static types preserved:
 *
 *   export class RegisteredContract extends Typor.mixin(Contract, Identity) {
 *     declare canonicalKey: string;
 *   }
 *
 * `RegisteredContract` now has every member of both bases, `instanceof` works against the mixed base, and
 * the whole thing is still a class — no interface, no `export type`.
 *
 * Semantics (documented because multiple inheritance always has a resolution order):
 *  - Bases compose LEFT to RIGHT; a later base overrides an earlier one on collision, matching the way
 *    `class B extends A` overrides A. The FIRST base keeps the real prototype chain, so `instanceof First`
 *    stays true and its constructor runs natively.
 *  - Constructors of the remaining bases are invoked in order, so each gets to initialise its own fields.
 *  - Accessors are copied with their descriptors, so getters/setters survive (a plain assign would flatten
 *    them into values — this is the bug most hand-rolled mixin helpers ship with).
 *  - Pure type-shape classes (all `declare` members) carry no runtime members at all, so composing them
 *    costs nothing beyond one empty subclass.
 */
export class Typor {
  /** Copy own property descriptors (methods, getters, setters) from `source` onto `target`. */
  private static copyMembers(target: object, source: object): void {
    for (const key of Reflect.ownKeys(source)) {
      if (key === 'constructor' || key === 'prototype' || key === 'name' || key === 'length') continue;
      const descriptor = Object.getOwnPropertyDescriptor(source, key);
      if (descriptor) Object.defineProperty(target, key, descriptor);
    }
  }

  /**
   * Compose two or more classes into one. See the class doc for resolution order.
   *
   * The instance and static shapes are written INLINE rather than as named `type` aliases. Both are
   * type-level OPERATORS — a conditional with `infer`, and a mapped `Omit` — which have no class or
   * interface form, so naming them only added two `type` declarations to a package that otherwise has
   * none. Inlining is the remedy the conventions prescribe for exactly this case.
   */
  static mixin<A extends IConstructor, B extends IConstructor>(
    a: A, b: B,
  ): IConstructor<
    (A extends IConstructor<infer I> ? I : never) & (B extends IConstructor<infer I> ? I : never)
  > & Omit<A, 'prototype'> & Omit<B, 'prototype'>;
  static mixin<A extends IConstructor, B extends IConstructor, C extends IConstructor>(
    a: A, b: B, c: C,
  ): IConstructor<
    (A extends IConstructor<infer I> ? I : never) & (B extends IConstructor<infer I> ? I : never)
    & (C extends IConstructor<infer I> ? I : never)
  > & Omit<A, 'prototype'> & Omit<B, 'prototype'> & Omit<C, 'prototype'>;
  static mixin<A extends IConstructor, B extends IConstructor, C extends IConstructor, D extends IConstructor>(
    a: A, b: B, c: C, d: D,
  ): IConstructor<
    (A extends IConstructor<infer I> ? I : never) & (B extends IConstructor<infer I> ? I : never)
    & (C extends IConstructor<infer I> ? I : never) & (D extends IConstructor<infer I> ? I : never)
  > & Omit<A, 'prototype'> & Omit<B, 'prototype'> & Omit<C, 'prototype'> & Omit<D, 'prototype'>;
  static mixin(...bases: IConstructor[]): IConstructor {
    const [first, ...rest] = bases;
    if (!first) throw new TypeError('Typor.mixin needs at least one base class.');
    if (!rest.length) return first;

    // The FIRST base stays the real prototype parent, so `instanceof first` holds and its constructor
    // runs natively. The others are folded in below.
    const Mixed = class extends first {
      constructor(...args: any[]) {
        super(...args);
        for (const base of rest) {
          // Run each remaining base's initialiser against `this`, so its own fields get set.
          const initialised = Reflect.construct(base, args, base);
          Object.assign(this, initialised);
        }
      }
    };

    for (const base of rest) {
      Typor.copyMembers(Mixed.prototype, base.prototype);
      Typor.copyMembers(Mixed, base);
    }
    Object.defineProperty(Mixed, 'name', {
      value: bases.map((b) => b.name).filter(Boolean).join('And') || 'Mixed',
    });
    return Mixed;
  }

  /** True when `value` carries every member named by the given contracts — a runtime `implements` check. */
  static satisfies(value: unknown, ...members: string[]): boolean {
    if (value === null || typeof value !== 'object') return false;
    return members.every((member) => member in (value as Record<string, unknown>));
  }
}

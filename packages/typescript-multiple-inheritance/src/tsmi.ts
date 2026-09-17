import type { AbstractConstructor } from './abstract-constructor';
import type { UnionToIntersection } from './union-to-intersection';
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
 *  - ABSTRACT bases are accepted, which is the case this exists for: splitting one large class into
 *    halves that are abstract precisely because neither is usable alone. `abstract` is erased at
 *    runtime, so `extends` and `Reflect.construct` work on them unchanged.
 *
 * ONE CHECK DOES NOT SURVIVE, and it is worth knowing before choosing this over a plain chain: the
 * result is a concrete constructor, so TypeScript no longer enforces that the final class implements
 * a base's abstract MEMBERS. That check is lost in any type-level mixin, not just this one. Where it
 * matters more than the shape does, use a linear `A extends B extends C` chain instead — the auth
 * controllers and ThemeManager are both built that way on purpose.
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
   * Compose ANY NUMBER of classes into one. See the class doc for resolution order.
   *
   * One variadic signature rather than a hand-written overload per arity. It used to be three
   * overloads — two, three and four bases — which meant five was a type error for no reason anyone
   * could act on: a class large enough to want splitting is exactly the class likely to want more
   * than four parts.
   *
   * `T[number]` indexes the tuple of bases, which yields a UNION; `UnionToIntersection` turns that
   * into the intersection the result actually has.
   *
   * The static side is `UnionToIntersection<T[number]>` — the base types WHOLE, not `Omit`-ed. The
   * `Omit<A, 'prototype'>` this used to do is what made the documented claim about static types false:
   * measured before the change, a class extending a mixin of two bases could not see either base's
   * statics at the type level, while the runtime had them both. Omitting `prototype` was meant to
   * avoid a conflict between the bases' prototypes; intersecting them instead gives `prototype: A & B`,
   * which is the honest type and costs nothing.
   */
  static mixin<T extends AbstractConstructor[]>(
    ...bases: T
  ): IConstructor<UnionToIntersection<T[number] extends AbstractConstructor<infer I> ? I : never>>
    & UnionToIntersection<T[number]>;
  static mixin(...bases: AbstractConstructor[]): any {
    const [first, ...rest] = bases;
    if (!first) throw new TypeError('Typor.mixin needs at least one base class.');
    // `abstract` is a COMPILE-TIME marker with no runtime existence, so a single abstract base is a
    // perfectly good constructor to hand back — the cast states that rather than hiding it.
    if (!rest.length) return first as IConstructor;

    // The FIRST base stays the real prototype parent, so `instanceof first` holds and its constructor
    // runs natively. The others are folded in below.
    const Mixed = class extends (first as IConstructor) {
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

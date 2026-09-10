/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyCtor = abstract new (...args: any[]) => object;
type InstanceOf<T extends AnyCtor> = T extends abstract new (...args: any[]) => infer I ? I : never;
/** Base constructor B, widened so instances also satisfy the mixed-in trait instance type `I`. */
type Mixed<B extends AnyCtor, I> = B & (abstract new (...args: any[]) => InstanceOf<B> & I);

/**
 * `implement` — compose trait DEFAULT methods onto a class. The multiple-inheritance escape hatch for when a
 * class already `extends` something (a `Reactor` component, a data class) but also needs one or more
 * {@link Protocol} traits' default behavior. Copies each trait prototype's OWN methods onto a new subclass of
 * `Base` (never clobbering methods the base already defines); the subclass still implements the traits'
 * `abstract` members (which carry zero runtime footprint).
 *
 *   class Card extends implement(Reactor, Comparable, Serializable) {
 *     compareTo(o: this) { … }      // implement the abstract contract; lessThan()/max()/… come free
 *     render() { … }
 *   }
 */
export function implement<B extends AnyCtor, T1 extends AnyCtor>(Base: B, t1: T1): Mixed<B, InstanceOf<T1>>;
export function implement<B extends AnyCtor, T1 extends AnyCtor, T2 extends AnyCtor>(Base: B, t1: T1, t2: T2): Mixed<B, InstanceOf<T1> & InstanceOf<T2>>;
export function implement<B extends AnyCtor, T1 extends AnyCtor, T2 extends AnyCtor, T3 extends AnyCtor>(Base: B, t1: T1, t2: T2, t3: T3): Mixed<B, InstanceOf<T1> & InstanceOf<T2> & InstanceOf<T3>>;
export function implement(Base: AnyCtor, ...traits: AnyCtor[]): AnyCtor {
  abstract class Composed extends (Base as any) {}
  for (const trait of traits) {
    let proto: object | null = trait.prototype;
    while (proto && proto !== Object.prototype) {
      for (const key of Object.getOwnPropertyNames(proto)) {
        if (key === 'constructor') continue;
        if (Object.prototype.hasOwnProperty.call(Composed.prototype, key)) continue; // never clobber the base
        const descriptor = Object.getOwnPropertyDescriptor(proto, key);
        if (descriptor) Object.defineProperty(Composed.prototype, key, descriptor);
      }
      proto = Object.getPrototypeOf(proto);
    }
  }
  return Composed;
}

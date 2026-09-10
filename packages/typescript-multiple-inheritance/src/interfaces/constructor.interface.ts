/**
 * Anything that can be `new`ed. The one structural contract the mixer needs.
 *
 * This is a genuine behavioural contract, so it is an `interface` — a CONSTRUCT SIGNATURE is precisely
 * what an interface expresses and a class cannot: a class type describes the INSTANCES it produces,
 * never "a thing that constructs a T". `class Constructor {}` used as a type would mean "an instance
 * of Constructor", which is the opposite of what `A extends Constructor` must accept.
 */
export interface IConstructor<T = object> {
  new (...args: any[]): T;
}

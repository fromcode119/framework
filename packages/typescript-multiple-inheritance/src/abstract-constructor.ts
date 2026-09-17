/**
 * Anything that can be `new`ed OR extended — including an ABSTRACT class.
 *
 * `IConstructor` only accepts a concrete class, because `new (...)` is not satisfied by an abstract
 * one. That put the package's whole purpose out of reach for the case it is most wanted in: splitting
 * a large class into behaviour halves, where every half is abstract precisely because no half is
 * usable alone. `class ThemeManager extends ThemeDiscovery, ThemeLifecycle` failed with
 * "typeof ThemeLifecycle is not assignable to IConstructor<object>".
 *
 * A TYPE ALIAS rather than an interface, and that is forced, not a preference: `abstract new (...)`
 * is legal in a construct signature but NOT as an interface member — TypeScript rejects it with
 * "'abstract' modifier cannot appear on a type member". reactor's `AnyCtor` is the same shape for the
 * same reason. Both live in glue packages, which the OOP guard skips structurally because they are
 * the layer that makes class-based code possible and cannot themselves be class-only.
 */
export type AbstractConstructor<T = object> = abstract new (...args: any[]) => T;

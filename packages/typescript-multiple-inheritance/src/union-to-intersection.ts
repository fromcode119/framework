/**
 * Turns a UNION into an INTERSECTION — `A | B | C` becomes `A & B & C`.
 *
 * Needed because indexing a tuple (`T[number]`) yields a union, while composing bases has to yield
 * every member of every base at once. Without it, mixing N classes would type as "one of these
 * shapes" rather than "all of them".
 *
 * It works by putting each member in a CONTRAVARIANT position — a parameter — where TypeScript is
 * forced to find a single type assignable to all of them, which is their intersection. There is no
 * other way to express this: it is a type-level operator, not a shape, so it has no class, interface
 * or Enum form. It lives in a glue package for that reason, beside `AbstractConstructor`.
 */
export type UnionToIntersection<U> =
  (U extends any ? (k: U) => void : never) extends (k: infer I) => void ? I : never;

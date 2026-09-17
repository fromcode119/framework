/**
 * What one class declaration says about itself, gathered syntactically.
 *
 * Names only — `base` is the base class's NAME, because inheritance is matched by name within a
 * scanned tree rather than resolved by a type checker.
 */
export interface IClassFacts {
  file: string;
  base: string | null;
  declared: string[];
  assigns: Set<string>;
  dereferences: Set<string>;
}

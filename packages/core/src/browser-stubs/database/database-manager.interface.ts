/** Browser-side stand-in for `IDatabaseManager` of `@fromcode119/database` — a type only, never a value. */
export interface IDatabaseManager {
  query?: (...args: unknown[]) => unknown;
}

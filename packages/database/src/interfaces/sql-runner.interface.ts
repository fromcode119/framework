/**
 * Runs one SQL statement and hands back its rows.
 *
 * The narrow slice of a connection the schema-reconciliation classes need: they are constructed with
 * a way to ask the database something, not with a manager, a pool or a dialect. That keeps them
 * testable with a function and unable to reach anything else.
 *
 * An INTERFACE with a CALL SIGNATURE, not a `type` alias of a function. It was the alias, copied
 * verbatim into four files — so one shape had four declarations and none of them was the canonical
 * one, which is the same defect this codebase bans for field names and setting keys. An interface
 * expresses a callable perfectly well; the alias was never the only way to say this.
 */
export interface ISqlRunner {
  (text: string, values?: unknown[]): Promise<Array<Record<string, unknown>>>;
}

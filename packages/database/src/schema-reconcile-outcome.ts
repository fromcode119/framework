/**
 * What a driver did when asked to bring one piece of an EXISTING table back in line with what a
 * field declares.
 *
 * Four answers, and the difference between them is what the operator needs to hear. `satisfied` is
 * the quiet, overwhelmingly common one — the declaration already holds, so nothing happened and
 * nothing needs saying. `changed` is worth a line. `failed` means the table's DATA makes the
 * declaration impossible (duplicate values for a unique, a NULL where one is now forbidden) and the
 * rule is NOT in force: reported rather than thrown, because refusing to boot a whole deployment
 * over one plugin's declaration is the worse answer — but it must be said, or a rule nobody is
 * enforcing looks exactly like one that is.
 *
 * `unsupported` is the driver having no way to answer, which is not a failure of this table.
 *
 * ONE type for every such reconciliation rather than one per kind: they differ only in which verb
 * fits `changed`, and two near-identical outcome classes is two places to get the defaulting wrong.
 */
export class SchemaReconcileOutcome {
  private constructor(
    readonly state: 'changed' | 'satisfied' | 'failed' | 'unsupported',
    readonly reason: string,
  ) {}

  /** The driver altered the table to match the declaration. */
  static changed(): SchemaReconcileOutcome {
    return new SchemaReconcileOutcome('changed', '');
  }

  /** Already true — a unique that covers the column, a column already nullable. */
  static satisfied(): SchemaReconcileOutcome {
    return new SchemaReconcileOutcome('satisfied', '');
  }

  static failed(reason: string): SchemaReconcileOutcome {
    return new SchemaReconcileOutcome('failed', reason);
  }

  static unsupported(reason: string): SchemaReconcileOutcome {
    return new SchemaReconcileOutcome('unsupported', reason);
  }
}

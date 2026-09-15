/**
 * What a driver did when asked to enforce a UNIQUE a field declares.
 *
 * Four answers, and the difference between them is what the operator needs to hear. `covered` is the
 * quiet, overwhelmingly common one — the rule is already enforced, so nothing happened and nothing
 * needs saying. `added` is worth a line. `failed` means the table holds duplicates and the rule is
 * NOT in force: reported rather than thrown, because refusing to boot a whole deployment over one
 * plugin's declaration is the worse answer — but it must be said, or a constraint nobody is
 * enforcing looks exactly like one that is.
 *
 * `unsupported` is the driver having no way to answer, which is not a failure of this table.
 */
export class DeclaredUniqueOutcome {
  private constructor(
    readonly state: 'added' | 'covered' | 'failed' | 'unsupported',
    readonly reason: string,
  ) {}

  static added(): DeclaredUniqueOutcome {
    return new DeclaredUniqueOutcome('added', '');
  }

  /** Already enforced — by the bare `(column)` form, or the swept `(column, tenant_id)` one. */
  static covered(): DeclaredUniqueOutcome {
    return new DeclaredUniqueOutcome('covered', '');
  }

  static failed(reason: string): DeclaredUniqueOutcome {
    return new DeclaredUniqueOutcome('failed', reason);
  }

  static unsupported(reason: string): DeclaredUniqueOutcome {
    return new DeclaredUniqueOutcome('unsupported', reason);
  }
}

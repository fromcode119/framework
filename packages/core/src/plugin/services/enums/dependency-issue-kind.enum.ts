import { Enum } from '@fromcode119/reactor';

/** Why a plugin dependency is unsatisfied. */
export class DependencyIssueKind extends Enum {
  static readonly MISSING = new DependencyIssueKind('missing');
  static readonly INCOMPATIBLE = new DependencyIssueKind('incompatible');
  static readonly INACTIVE = new DependencyIssueKind('inactive');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a raw string to a member; defaults to MISSING. */
  static resolve(value: unknown): DependencyIssueKind {
    if (value instanceof DependencyIssueKind) return value;
    const found = DependencyIssueKind.fromValue(String(value ?? '').trim().toLowerCase());
    return (found as DependencyIssueKind | undefined) ?? DependencyIssueKind.MISSING;
  }
}

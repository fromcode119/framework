import { Enum } from '@fromcode119/reactor';

/** Why a plugin dependency is unsatisfied. */
export class DependencyIssueType extends Enum {
  static readonly MISSING = new DependencyIssueType('missing');
  static readonly INCOMPATIBLE = new DependencyIssueType('incompatible');
  static readonly INACTIVE = new DependencyIssueType('inactive');

  private constructor(value: string) {
    super(value);
  }

  /**
   * Resolve an API-sourced value to a member; anything unknown is INCOMPATIBLE (the conservative
   * reading — "we cannot satisfy this dependency").
   *
   * The activation endpoint returns `issues[].type` as a plain string (`Enum.toJSON()` serialises to
   * `.value`), so an un-hydrated row makes `issue.type.value` `undefined` — and
   * `dependency-dialog.client.tsx` called `.toUpperCase()` on it. Hydrate at the fetch boundary.
   */
  static resolve(value: unknown): DependencyIssueType {
    if (value instanceof DependencyIssueType) return value;
    const found = DependencyIssueType.fromValue(String(value ?? '').trim().toLowerCase());
    return (found as DependencyIssueType | undefined) ?? DependencyIssueType.INCOMPATIBLE;
  }
}

/**
 * What every guard, in every area, is allowed to find: NOTHING.
 *
 * This replaces seventeen per-area baseline maps. Each of them recorded how much of a rule was being
 * broken on the day the rule was written, and each was described as debt to pay down. None of them
 * was ever paid down to zero. What they actually did was turn a rule into a quota: a guard reporting
 * "plugins: 698 — at baseline 698" is a guard reporting success, and 698 violations of a rule the
 * codebase says it holds.
 *
 * The failure mode is not that the numbers were wrong. It is that a number greater than zero makes
 * the guard unreadable — nobody can tell a real regression from an accounting change, and every
 * argument about whether something is a violation ends in raising the line rather than fixing the
 * code. Two of them were found to be permission rather than debt within a single day's work: a
 * type-alias exemption list whose every entry turned out to be expressible, and a counted bucket that
 * printed a total nothing could fail on.
 *
 * So the target is zero, and it is a constant rather than a lookup. There is no per-area value to
 * raise, no `arch-guard.json` for a repository to declare an allowance in, and no code path that
 * turns "we have not fixed this yet" into "this is fine".
 *
 * A rule with exceptions belongs in the rule. If some construct is genuinely allowed, the guard must
 * not report it — that is a change to what the guard MATCHES, argued on its merits and visible in the
 * scanner, not a number in a table that silently covers whatever happens to be there.
 */
export class GuardTarget {
  /** Zero. For every guard, every area, always. */
  static readonly COUNT = 0;

  /** Reads as a lookup at the call sites that used to perform one, and always answers zero. */
  static forArea(_area: string): number {
    return GuardTarget.COUNT;
  }
}

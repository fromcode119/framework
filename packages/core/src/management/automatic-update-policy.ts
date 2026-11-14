import semver from 'semver';
import type { IAutomaticUpdateInput } from '@core/management/interfaces/automatic-update-input.interface';
import type { IAutomaticUpdatePlan } from '@core/management/interfaces/automatic-update-plan.interface';

/**
 * Whether this installation updates itself now, and to which version.
 *
 * An operator's "Update now" always goes ahead: a person chose it, having seen the release notes. Without
 * one, the newest release is installed automatically while Settings → Updates says so — unless a release
 * on the way there is marked BREAKING in the changelog, which waits for a person, because a breaking
 * release can need something only the operator can do.
 */
export class AutomaticUpdatePolicy {
  static readonly REQUESTED = 'requested';
  static readonly AUTOMATIC = 'automatic';
  static readonly HELD_BREAKING = 'heldBreaking';
  static readonly HELD_FAILED = 'heldFailed';
  /** Rolling was not possible for this version; it is tried again at night, or now with "Update with restart". */
  static readonly HELD_ROLLING = 'heldRolling';
  /** Hours (UTC, the box's clock) in which a version held for rolling is tried again — when the box is quietest. */
  static readonly NIGHT_FROM_HOUR = 2;
  static readonly NIGHT_TO_HOUR = 5;
  /** Within the night, one try an hour: each try downloads nothing new, but writes and restores the folder. */
  static readonly RETRY_EVERY_MS = 60 * 60 * 1000;
  static readonly OFF = 'off';
  static readonly CURRENT = 'current';
  /** The release source could not be read, so whether anything newer exists is not known. */
  static readonly UNKNOWN = 'unknown';

  static decide(input: IAutomaticUpdateInput): IAutomaticUpdatePlan {
    const decided = AutomaticUpdatePolicy.target(input);
    if (!decided.target || !AutomaticUpdatePolicy.waitsForRolling(input, decided.target)) return decided;
    return { current: decided.current, target: '', reason: AutomaticUpdatePolicy.HELD_ROLLING, heldBy: decided.target };
  }

  /**
   * A version held because rolling was out is not retried every minute — nothing would have changed — but
   * once an hour in the night, and at once when an operator allows the restart.
   */
  private static waitsForRolling(input: IAutomaticUpdateInput, target: string): boolean {
    if (AutomaticUpdatePolicy.bare(input.held ?? '') !== target) return false;
    if (AutomaticUpdatePolicy.bare(input.restartAllowed ?? '') === target) return false;
    const now = input.now ?? new Date();
    const hour = now.getUTCHours();
    const night = hour >= AutomaticUpdatePolicy.NIGHT_FROM_HOUR && hour < AutomaticUpdatePolicy.NIGHT_TO_HOUR;
    const heldAt = Date.parse(input.heldAt ?? '');
    const due = !Number.isFinite(heldAt) || now.getTime() - heldAt >= AutomaticUpdatePolicy.RETRY_EVERY_MS;
    return !(night && due);
  }

  private static target(input: IAutomaticUpdateInput): IAutomaticUpdatePlan {
    const current = AutomaticUpdatePolicy.bare(input.current);
    const plan = (target: string, reason: string, heldBy = ''): IAutomaticUpdatePlan => ({ current, target, reason, heldBy });
    const requested = AutomaticUpdatePolicy.bare(input.requested);
    if (requested && semver.valid(requested) && semver.valid(current) && semver.gt(requested, current)) {
      return plan(requested, AutomaticUpdatePolicy.REQUESTED);
    }

    const latest = AutomaticUpdatePolicy.bare(input.latest);
    if (!semver.valid(latest) || !semver.valid(current) || !semver.gt(latest, current)) return plan('', AutomaticUpdatePolicy.CURRENT);
    if (!input.automatic) return plan('', AutomaticUpdatePolicy.OFF);

    const breaking = input.pending
      .filter((release) => release.breaking && semver.valid(AutomaticUpdatePolicy.bare(release.version)))
      .map((release) => AutomaticUpdatePolicy.bare(release.version))
      .filter((version) => semver.gt(version, current) && semver.lte(version, latest))
      .sort(semver.compare)[0];
    if (breaking) return plan('', AutomaticUpdatePolicy.HELD_BREAKING, breaking);
    // A version that already failed here is not retried on its own every minute — each try is downtime.
    // "Update now" retries it; a newer release is tried normally.
    if (AutomaticUpdatePolicy.bare(input.failed ?? '') === latest) return plan('', AutomaticUpdatePolicy.HELD_FAILED, latest);
    return plan(latest, AutomaticUpdatePolicy.AUTOMATIC);
  }

  private static bare(version: string): string {
    return String(version || '').trim().replace(/^v/, '');
  }
}

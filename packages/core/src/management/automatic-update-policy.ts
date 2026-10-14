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
  static readonly OFF = 'off';
  static readonly CURRENT = 'current';
  /** The release source could not be read, so whether anything newer exists is not known. */
  static readonly UNKNOWN = 'unknown';

  static decide(input: IAutomaticUpdateInput): IAutomaticUpdatePlan {
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

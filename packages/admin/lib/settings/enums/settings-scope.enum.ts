import { Enum } from '@fromcode119/react-class-components';

/**
 * Which scope a settings key belongs to — where it is set, not where it is being looked at.
 *
 * The screen uses this to explain an ABSENCE: keys it is not showing are either the platform's while
 * the operator stands inside a site, or per-site while they stand in the platform. Saying the wrong
 * one sends them to the wrong screen to change a value they can see the effect of but not the source.
 */
export class SettingsScope extends Enum {
  /** Per-site. */
  static readonly SITE = new SettingsScope('site');

  /** The platform's own, shared by every site. */
  static readonly PLATFORM = new SettingsScope('platform');

  private constructor(value: string) {
    super(value);
  }
}

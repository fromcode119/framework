import { Enum } from '@fromcode119/reactor';

/**
 * Which bucket a plugin falls into in the health report. Derived from state + health; `HELD` is the
 * capability-drift/needs-re-approval case that is otherwise invisible as a plain INACTIVE.
 */
export class PluginHealthBucket extends Enum {
  static readonly ACTIVE = new PluginHealthBucket('active');
  static readonly HELD = new PluginHealthBucket('held');
  static readonly ERROR = new PluginHealthBucket('error');
  static readonly INACTIVE = new PluginHealthBucket('inactive');

  private constructor(value: string) {
    super(value);
  }
}

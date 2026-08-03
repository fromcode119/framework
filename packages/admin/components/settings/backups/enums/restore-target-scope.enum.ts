import { Enum } from '@fromcode119/reactor';

/** What a restore targets: the whole system, a single plugin, or a single theme. */
export class RestoreTargetScope extends Enum {
  static readonly SYSTEM = new RestoreTargetScope('system');
  static readonly PLUGIN = new RestoreTargetScope('plugin');
  static readonly THEME = new RestoreTargetScope('theme');

  private constructor(value: string) {
    super(value);
  }
}

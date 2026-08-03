import { Enum } from '@fromcode119/reactor';

/** How far a declared plugin capability reaches. */
export class CapabilityScope extends Enum {
  static readonly SELF = new CapabilityScope('self');
  static readonly PLUGIN_TARGET = new CapabilityScope('plugin-target');
  static readonly GLOBAL = new CapabilityScope('global');

  private constructor(value: string) {
    super(value);
  }
}

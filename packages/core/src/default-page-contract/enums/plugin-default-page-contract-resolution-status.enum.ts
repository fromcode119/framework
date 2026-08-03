import { Enum } from '@fromcode119/reactor';

/** PluginDefaultPageContractResolutionStatus — one of the 3 states this contract stage can be in. */
export class PluginDefaultPageContractResolutionStatus extends Enum {
  static readonly BLOCKED = new PluginDefaultPageContractResolutionStatus('blocked');
  static readonly READY = new PluginDefaultPageContractResolutionStatus('ready');
  static readonly SKIPPED = new PluginDefaultPageContractResolutionStatus('skipped');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a raw wire string to a member; defaults to BLOCKED. */
  static resolve(value: unknown): PluginDefaultPageContractResolutionStatus {
    if (value instanceof PluginDefaultPageContractResolutionStatus) return value;
    const found = PluginDefaultPageContractResolutionStatus.fromValue(String(value ?? '').trim());
    return (found as PluginDefaultPageContractResolutionStatus | undefined) ?? PluginDefaultPageContractResolutionStatus.BLOCKED;
  }
}

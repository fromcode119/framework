import { Enum } from '@fromcode119/reactor';

/** PluginDefaultPageContractMaterializationStatus — one of the 5 states this contract stage can be in. */
export class PluginDefaultPageContractMaterializationStatus extends Enum {
  static readonly AMBIGUOUS = new PluginDefaultPageContractMaterializationStatus('ambiguous');
  static readonly BLOCKED = new PluginDefaultPageContractMaterializationStatus('blocked');
  static readonly DEFERRED = new PluginDefaultPageContractMaterializationStatus('deferred');
  static readonly READY = new PluginDefaultPageContractMaterializationStatus('ready');
  static readonly SKIPPED = new PluginDefaultPageContractMaterializationStatus('skipped');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a raw wire string to a member; defaults to AMBIGUOUS. */
  static resolve(value: unknown): PluginDefaultPageContractMaterializationStatus {
    if (value instanceof PluginDefaultPageContractMaterializationStatus) return value;
    const found = PluginDefaultPageContractMaterializationStatus.fromValue(String(value ?? '').trim());
    return (found as PluginDefaultPageContractMaterializationStatus | undefined) ?? PluginDefaultPageContractMaterializationStatus.AMBIGUOUS;
  }
}

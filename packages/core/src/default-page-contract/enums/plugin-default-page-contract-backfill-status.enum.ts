import { Enum } from '@fromcode119/reactor';

/** PluginDefaultPageContractBackfillStatus — one of the 6 states this contract stage can be in. */
export class PluginDefaultPageContractBackfillStatus extends Enum {
  static readonly ALREADY_ASSOCIATED = new PluginDefaultPageContractBackfillStatus('already-associated');
  static readonly AMBIGUOUS = new PluginDefaultPageContractBackfillStatus('ambiguous');
  static readonly BLOCKED = new PluginDefaultPageContractBackfillStatus('blocked');
  static readonly DEFERRED = new PluginDefaultPageContractBackfillStatus('deferred');
  static readonly SAFE_TO_ASSOCIATE = new PluginDefaultPageContractBackfillStatus('safe-to-associate');
  static readonly SKIPPED = new PluginDefaultPageContractBackfillStatus('skipped');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a raw wire string to a member; defaults to ALREADY_ASSOCIATED. */
  static resolve(value: unknown): PluginDefaultPageContractBackfillStatus {
    if (value instanceof PluginDefaultPageContractBackfillStatus) return value;
    const found = PluginDefaultPageContractBackfillStatus.fromValue(String(value ?? '').trim());
    return (found as PluginDefaultPageContractBackfillStatus | undefined) ?? PluginDefaultPageContractBackfillStatus.ALREADY_ASSOCIATED;
  }
}

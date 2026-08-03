import { Enum } from '@fromcode119/reactor';

/** PluginDefaultPageContractBackfillAction — one of the 6 states this contract stage can be in. */
export class PluginDefaultPageContractBackfillAction extends Enum {
  static readonly ALREADY_ASSOCIATED = new PluginDefaultPageContractBackfillAction('already-associated');
  static readonly AMBIGUOUS = new PluginDefaultPageContractBackfillAction('ambiguous');
  static readonly ASSOCIATE_EXISTING = new PluginDefaultPageContractBackfillAction('associate-existing');
  static readonly BLOCKED = new PluginDefaultPageContractBackfillAction('blocked');
  static readonly DEFERRED = new PluginDefaultPageContractBackfillAction('deferred');
  static readonly SKIPPED = new PluginDefaultPageContractBackfillAction('skipped');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a raw wire string to a member; defaults to ALREADY_ASSOCIATED. */
  static resolve(value: unknown): PluginDefaultPageContractBackfillAction {
    if (value instanceof PluginDefaultPageContractBackfillAction) return value;
    const found = PluginDefaultPageContractBackfillAction.fromValue(String(value ?? '').trim());
    return (found as PluginDefaultPageContractBackfillAction | undefined) ?? PluginDefaultPageContractBackfillAction.ALREADY_ASSOCIATED;
  }
}

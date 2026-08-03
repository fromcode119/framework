import { Enum } from '@fromcode119/reactor';

/** PluginDefaultPageContractMaterializationAction — one of the 6 states this contract stage can be in. */
export class PluginDefaultPageContractMaterializationAction extends Enum {
  static readonly ADOPT_EXISTING = new PluginDefaultPageContractMaterializationAction('adopt-existing');
  static readonly AMBIGUOUS = new PluginDefaultPageContractMaterializationAction('ambiguous');
  static readonly BLOCKED = new PluginDefaultPageContractMaterializationAction('blocked');
  static readonly CREATE_MISSING = new PluginDefaultPageContractMaterializationAction('create-missing');
  static readonly DEFERRED = new PluginDefaultPageContractMaterializationAction('deferred');
  static readonly SKIP = new PluginDefaultPageContractMaterializationAction('skip');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a raw wire string to a member; defaults to ADOPT_EXISTING. */
  static resolve(value: unknown): PluginDefaultPageContractMaterializationAction {
    if (value instanceof PluginDefaultPageContractMaterializationAction) return value;
    const found = PluginDefaultPageContractMaterializationAction.fromValue(String(value ?? '').trim());
    return (found as PluginDefaultPageContractMaterializationAction | undefined) ?? PluginDefaultPageContractMaterializationAction.ADOPT_EXISTING;
  }
}

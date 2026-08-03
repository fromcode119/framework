import { Enum } from '@fromcode119/reactor';

/** PluginDefaultPageContractMaterializationExecutionOutcome — one of the 4 states this contract stage can be in. */
export class PluginDefaultPageContractMaterializationExecutionOutcome extends Enum {
  static readonly APPLIED = new PluginDefaultPageContractMaterializationExecutionOutcome('applied');
  static readonly FAILED = new PluginDefaultPageContractMaterializationExecutionOutcome('failed');
  static readonly NOOP = new PluginDefaultPageContractMaterializationExecutionOutcome('noop');
  static readonly SKIPPED = new PluginDefaultPageContractMaterializationExecutionOutcome('skipped');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a raw wire string to a member; defaults to APPLIED. */
  static resolve(value: unknown): PluginDefaultPageContractMaterializationExecutionOutcome {
    if (value instanceof PluginDefaultPageContractMaterializationExecutionOutcome) return value;
    const found = PluginDefaultPageContractMaterializationExecutionOutcome.fromValue(String(value ?? '').trim());
    return (found as PluginDefaultPageContractMaterializationExecutionOutcome | undefined) ?? PluginDefaultPageContractMaterializationExecutionOutcome.APPLIED;
  }
}

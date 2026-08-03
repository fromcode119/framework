import { Enum } from '@fromcode119/reactor';

/** PluginDefaultPageContractAssociationPersistStatus — one of the 3 states this contract stage can be in. */
export class PluginDefaultPageContractAssociationPersistStatus extends Enum {
  static readonly APPLIED = new PluginDefaultPageContractAssociationPersistStatus('applied');
  static readonly CONFLICT = new PluginDefaultPageContractAssociationPersistStatus('conflict');
  static readonly NOOP = new PluginDefaultPageContractAssociationPersistStatus('noop');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a raw wire string to a member; defaults to APPLIED. */
  static resolve(value: unknown): PluginDefaultPageContractAssociationPersistStatus {
    if (value instanceof PluginDefaultPageContractAssociationPersistStatus) return value;
    const found = PluginDefaultPageContractAssociationPersistStatus.fromValue(String(value ?? '').trim());
    return (found as PluginDefaultPageContractAssociationPersistStatus | undefined) ?? PluginDefaultPageContractAssociationPersistStatus.APPLIED;
  }
}

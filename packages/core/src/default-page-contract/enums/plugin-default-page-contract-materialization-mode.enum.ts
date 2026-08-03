import { Enum } from '@fromcode119/reactor';

/** PluginDefaultPageContractMaterializationMode — one of the 3 states this contract stage can be in. */
export class PluginDefaultPageContractMaterializationMode extends Enum {
  static readonly ADOPT_ONLY = new PluginDefaultPageContractMaterializationMode('adopt-only');
  static readonly PER_RECORD_DOCUMENT = new PluginDefaultPageContractMaterializationMode('per-record-document');
  static readonly SINGLETON_DOCUMENT = new PluginDefaultPageContractMaterializationMode('singleton-document');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a raw wire string to a member; defaults to ADOPT_ONLY. */
  static resolve(value: unknown): PluginDefaultPageContractMaterializationMode {
    if (value instanceof PluginDefaultPageContractMaterializationMode) return value;
    const found = PluginDefaultPageContractMaterializationMode.fromValue(String(value ?? '').trim());
    return (found as PluginDefaultPageContractMaterializationMode | undefined) ?? PluginDefaultPageContractMaterializationMode.ADOPT_ONLY;
  }
}

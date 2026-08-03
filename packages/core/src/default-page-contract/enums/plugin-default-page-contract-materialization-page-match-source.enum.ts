import { Enum } from '@fromcode119/reactor';

/** PluginDefaultPageContractMaterializationPageMatchSource — one of the 2 states this contract stage can be in. */
export class PluginDefaultPageContractMaterializationPageMatchSource extends Enum {
  static readonly CUSTOM_PERMALINK = new PluginDefaultPageContractMaterializationPageMatchSource('customPermalink');
  static readonly SLUG = new PluginDefaultPageContractMaterializationPageMatchSource('slug');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a raw wire string to a member; defaults to CUSTOM_PERMALINK. */
  static resolve(value: unknown): PluginDefaultPageContractMaterializationPageMatchSource {
    if (value instanceof PluginDefaultPageContractMaterializationPageMatchSource) return value;
    const found = PluginDefaultPageContractMaterializationPageMatchSource.fromValue(String(value ?? '').trim());
    return (found as PluginDefaultPageContractMaterializationPageMatchSource | undefined) ?? PluginDefaultPageContractMaterializationPageMatchSource.CUSTOM_PERMALINK;
  }
}

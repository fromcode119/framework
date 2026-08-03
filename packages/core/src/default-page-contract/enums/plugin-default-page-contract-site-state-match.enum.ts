import { Enum } from '@fromcode119/reactor';

/** PluginDefaultPageContractSiteStateMatch — one of the 4 states this contract stage can be in. */
export class PluginDefaultPageContractSiteStateMatch extends Enum {
  static readonly BOTH = new PluginDefaultPageContractSiteStateMatch('both');
  static readonly CANONICAL_KEY = new PluginDefaultPageContractSiteStateMatch('canonicalKey');
  static readonly CAPABILITY = new PluginDefaultPageContractSiteStateMatch('capability');
  static readonly NONE = new PluginDefaultPageContractSiteStateMatch('none');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a raw wire string to a member; defaults to BOTH. */
  static resolve(value: unknown): PluginDefaultPageContractSiteStateMatch {
    if (value instanceof PluginDefaultPageContractSiteStateMatch) return value;
    const found = PluginDefaultPageContractSiteStateMatch.fromValue(String(value ?? '').trim());
    return (found as PluginDefaultPageContractSiteStateMatch | undefined) ?? PluginDefaultPageContractSiteStateMatch.BOTH;
  }
}

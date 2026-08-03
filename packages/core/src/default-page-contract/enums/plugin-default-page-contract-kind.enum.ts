import { Enum } from '@fromcode119/reactor';

/** PluginDefaultPageContractKind — one of the 5 states this contract stage can be in. */
export class PluginDefaultPageContractKind extends Enum {
  static readonly DETAIL = new PluginDefaultPageContractKind('detail');
  static readonly FORM_PAGE = new PluginDefaultPageContractKind('form-page');
  static readonly INDEX = new PluginDefaultPageContractKind('index');
  static readonly LANDING = new PluginDefaultPageContractKind('landing');
  static readonly POLICY = new PluginDefaultPageContractKind('policy');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a raw wire string to a member; defaults to DETAIL. */
  static resolve(value: unknown): PluginDefaultPageContractKind {
    if (value instanceof PluginDefaultPageContractKind) return value;
    const found = PluginDefaultPageContractKind.fromValue(String(value ?? '').trim());
    return (found as PluginDefaultPageContractKind | undefined) ?? PluginDefaultPageContractKind.DETAIL;
  }
}

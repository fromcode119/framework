import { Enum } from '@fromcode119/reactor';

/** PluginDefaultPageContractResolutionSource — one of the 3 states this contract stage can be in. */
export class PluginDefaultPageContractResolutionSource extends Enum {
  static readonly DECLARATION = new PluginDefaultPageContractResolutionSource('declaration');
  static readonly SITE_STATE = new PluginDefaultPageContractResolutionSource('site-state');
  static readonly THEME_OVERRIDE = new PluginDefaultPageContractResolutionSource('theme-override');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a raw wire string to a member; defaults to DECLARATION. */
  static resolve(value: unknown): PluginDefaultPageContractResolutionSource {
    if (value instanceof PluginDefaultPageContractResolutionSource) return value;
    const found = PluginDefaultPageContractResolutionSource.fromValue(String(value ?? '').trim());
    return (found as PluginDefaultPageContractResolutionSource | undefined) ?? PluginDefaultPageContractResolutionSource.DECLARATION;
  }
}

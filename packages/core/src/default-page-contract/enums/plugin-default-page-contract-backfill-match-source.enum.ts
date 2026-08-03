import { Enum } from '@fromcode119/reactor';

/** PluginDefaultPageContractBackfillMatchSource — one of the 2 states this contract stage can be in. */
export class PluginDefaultPageContractBackfillMatchSource extends Enum {
  static readonly CUSTOM_PERMALINK = new PluginDefaultPageContractBackfillMatchSource('customPermalink');
  static readonly SLUG = new PluginDefaultPageContractBackfillMatchSource('slug');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a raw wire string to a member; defaults to CUSTOM_PERMALINK. */
  static resolve(value: unknown): PluginDefaultPageContractBackfillMatchSource {
    if (value instanceof PluginDefaultPageContractBackfillMatchSource) return value;
    const found = PluginDefaultPageContractBackfillMatchSource.fromValue(String(value ?? '').trim());
    return (found as PluginDefaultPageContractBackfillMatchSource | undefined) ?? PluginDefaultPageContractBackfillMatchSource.CUSTOM_PERMALINK;
  }
}

import { Enum } from '@fromcode119/reactor';

/** Active tab on the plugin detail page. Encoded as its `.value` in the `?tab=` URL param. */
export class PluginDetailTab extends Enum {
  static readonly OVERVIEW = new PluginDetailTab('overview');
  static readonly SETTINGS = new PluginDetailTab('settings');
  static readonly PERMISSIONS = new PluginDetailTab('permissions');
  static readonly RESOURCES = new PluginDetailTab('resources');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a `?tab=` string to a member; defaults to OVERVIEW. */
  static resolve(value: unknown): PluginDetailTab {
    if (value instanceof PluginDetailTab) return value;
    const found = PluginDetailTab.fromValue(String(value ?? '').trim().toLowerCase());
    return (found as PluginDetailTab | undefined) ?? PluginDetailTab.OVERVIEW;
  }
}

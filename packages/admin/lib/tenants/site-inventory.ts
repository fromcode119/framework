import { CoercionUtils } from '@fromcode119/core/client';

/**
 * What is INSTALLED on the platform — the plugins a new site may run, the themes it may render with,
 * the appearances a workspace may be locked to, and the declared workspace presets (T6).
 */
export class SiteInventory {
  private constructor(
    readonly plugins: Array<{ slug: string; version: string; name: string; state?: string; heldReason?: string; runnable?: boolean; description?: string; icon?: string }>,
    readonly themes: Array<{ slug: string; version: string; name: string }>,
    readonly appearances: Array<{ slug: string; version: string; name: string }>,
    readonly presets: Array<{ id: string; label: string; description: string; plugins: string[]; appearance: string }>,
  ) {}

  static empty(): SiteInventory {
    return new SiteInventory([], [], [], []);
  }

  static from(raw: unknown): SiteInventory {
    const input = (raw && typeof raw === 'object' ? raw : {}) as Record<string, any>;
    const entries = (list: unknown) => (Array.isArray(list) ? list : []).map((entry: any) => ({
      slug: CoercionUtils.toString(entry?.slug),
      version: CoercionUtils.toString(entry?.version),
      name: CoercionUtils.toString(entry?.name) || CoercionUtils.toString(entry?.slug),
      state: CoercionUtils.toString(entry?.state),
      heldReason: CoercionUtils.toString(entry?.heldReason),
      // Absent means runnable: themes and appearances carry no state, and an older api sends none.
      runnable: entry?.runnable !== false,
      description: CoercionUtils.toString(entry?.description),
      icon: CoercionUtils.toString(entry?.icon) || 'Box',
    }));
    const presets = (Array.isArray(input.presets) ? input.presets : []).map((entry: any) => ({
      id: CoercionUtils.toString(entry?.id),
      label: CoercionUtils.toString(entry?.label),
      description: CoercionUtils.toString(entry?.description),
      plugins: Array.isArray(entry?.plugins) ? entry.plugins.map((slug: unknown) => CoercionUtils.toString(slug)) : [],
      appearance: CoercionUtils.toString(entry?.appearance),
    })).filter((preset: { id: string }) => preset.id.length > 0);
    return new SiteInventory(entries(input.plugins), entries(input.themes), entries(input.appearances), presets);
  }
}

import type { IAppearanceSummary } from '@core/appearance/interfaces/appearance-summary.interface';
import { TenantKindPreset } from '@core/tenant/provisioning/tenant-kind-preset';

/**
 * The workspace presets the "New site" form offers: ONE per installed appearance that declares a
 * `workspace` block in its appearance.json. The framework names no product — a preset's id is the
 * appearance's slug, its plugins are the appearance's own declaration, and the workspace it creates is
 * locked to that appearance. Applied only when the operator picks it, never a hidden default.
 */
export class TenantKindPresets {
  static fromAppearances(appearances: readonly IAppearanceSummary[]): TenantKindPreset[] {
    return appearances
      .filter((appearance) => !appearance.builtIn && appearance.workspace)
      .map((appearance) => new TenantKindPreset(
        appearance.slug,
        appearance.workspace!.label || appearance.name,
        appearance.workspace!.description || '',
        appearance.workspace!.plugins,
        appearance.slug,
      ));
  }

  static find(presets: readonly TenantKindPreset[], id: unknown): TenantKindPreset | undefined {
    const needle = String(id ?? '').trim().toLowerCase();
    return presets.find((preset) => preset.id === needle);
  }
}

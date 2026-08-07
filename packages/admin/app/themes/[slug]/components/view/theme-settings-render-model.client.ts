import type { ThemeMode } from '@fromcode119/core/client';
import type { ThemeSettingsTab } from '@/app/themes/[slug]/enums/theme-settings-tab.enum';
import type { ITheme } from '@/app/themes/[slug]/interfaces/theme.interface';
import type { IThemeSettingsPageView } from '@/app/themes/[slug]/interfaces/theme-settings-page-view.interface';
import { ThemePreviewUtils } from '@/lib/theme-preview-utils';
import { ThemePreviewSwatch } from '@/app/themes/[slug]/theme-preview-swatch';

/**
 * The render-time derived model for the theme settings page (grouped variables/settings, preview
 * palette, live preview url), extracted from the former 1000-line `render()`.
 *
 * A real class, not a bag of `any`: every field below is typed, so a view that renders one into JSX is
 * checked against `ReactNode` — which is exactly what an untyped `themeDetail.state` (a `ThemeState`
 * Enum instance) slipped past on its way to "Minified React error #31".
 *
 * Built ONLY once the page has a loaded theme: the caller narrows `themeDetail` and passes it in, so
 * `themeDetail` here is non-null and no view needs `?.` on it. The old builder returned a half-filled
 * object during loading that nothing ever read.
 */
export class ThemeSettingsRenderModel {
  readonly adminTheme: ThemeMode;
  readonly themeDetail: ITheme;
  readonly marketplaceVersion: string | null;
  readonly activeTab: ThemeSettingsTab;
  readonly tempVariables: Record<string, string>;
  readonly tempLayouts: Record<string, string>;
  readonly tempSettings: Record<string, unknown>;

  /** Variable keys bucketed by their schema `group` — one card per group in the variables panel. */
  readonly groupedVariables: Record<string, string[]>;
  readonly allVarKeys: string[];
  /** Settings keys bucketed by their schema `group` — one section per group in the extensions panel. */
  readonly groupedThemeSettings: Record<string, string[]>;
  readonly themeSettingsSchema: NonNullable<ITheme['settingsSchema']>;
  readonly allThemeSettingKeys: string[];
  readonly integrationRequirements: NonNullable<ITheme['integrationRequirements']>;

  /** The theme's own colour variables, live from the editor — the Visual Preview card's only source. */
  readonly previewSwatches: ThemePreviewSwatch[];
  readonly livePreviewUrl: string;

  static build(page: IThemeSettingsPageView, themeDetail: ITheme): ThemeSettingsRenderModel {
    return new ThemeSettingsRenderModel(page, themeDetail);
  }

  private constructor(page: IThemeSettingsPageView, themeDetail: ITheme) {
    this.adminTheme = page.adminTheme;
    this.themeDetail = themeDetail;
    this.marketplaceVersion = page.marketplaceVersion;
    this.activeTab = page.activeTab;
    this.tempVariables = page.tempVariables;
    this.tempLayouts = page.tempLayouts;
    this.tempSettings = page.tempSettings;

    this.allVarKeys = Object.keys(this.tempVariables);
    this.groupedVariables = ThemeSettingsRenderModel.bucketByGroup(
      this.allVarKeys,
      (key) => themeDetail.variableSchema?.[key]?.group,
      { General: [] },
    );

    this.themeSettingsSchema = themeDetail.settingsSchema || {};
    this.allThemeSettingKeys = Array.from(
      new Set([...Object.keys(this.themeSettingsSchema), ...Object.keys(this.tempSettings)]),
    );
    this.groupedThemeSettings = ThemeSettingsRenderModel.bucketByGroup(
      this.allThemeSettingKeys,
      (key) => this.themeSettingsSchema[key]?.group,
      {},
    );

    this.integrationRequirements = Array.isArray(themeDetail.integrationRequirements)
      ? themeDetail.integrationRequirements
      : [];

    // `tempVariables` is already `{...theme.variables, ...savedConfig.variables}`, so it IS the complete
    // declared set with the operator's overrides on top — there is no separate defaults source to merge.
    this.previewSwatches = ThemePreviewSwatch.listFrom(this.tempVariables, themeDetail.variableSchema);

    this.livePreviewUrl = ThemePreviewUtils.normalizePreviewUrl(
      this.tempSettings.previewUrl || this.tempSettings.siteUrl,
      themeDetail.settingsDefaults?.previewUrl || themeDetail.settingsDefaults?.siteUrl,
      page.pluginSettings,
    );
  }

  /** Bucket `keys` by the group each declares, falling back to the "General" bucket. */
  private static bucketByGroup(
    keys: string[],
    groupOf: (key: string) => string | undefined,
    seed: Record<string, string[]>,
  ): Record<string, string[]> {
    const grouped: Record<string, string[]> = { ...seed };
    for (const key of keys) {
      const group = groupOf(key) || 'General';
      if (!grouped[group]) grouped[group] = [];
      grouped[group].push(key);
    }
    return grouped;
  }
}

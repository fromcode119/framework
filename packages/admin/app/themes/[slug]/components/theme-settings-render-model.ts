"use client";

import { ThemePreviewUtils } from '@/lib/theme-preview-utils';

/**
 * Computes the render-time derived model for the theme settings page (grouped variables/settings,
 * preview palette, live preview url), extracted from the former 1000-line `render()`. `page` is the
 * `ThemeSettingsPage` instance, typed loosely to avoid a circular import.
 */
export class ThemeSettingsRenderModel {
  static build(page: any): any {
    const adminTheme = page.theme;
    const settings = page.runtime.plugins?.settings;
    const { themeDetail, marketplaceVersion, loading, activeTab, tempVariables, tempLayouts, tempSettings } = page.state;
    if (loading || !themeDetail) {
      return { adminTheme, settings, themeDetail, loading, activeTab };
    }

    const groupedVariables: Record<string, string[]> = { General: [] };
    const allVarKeys = Object.keys(tempVariables);
    allVarKeys.forEach((key) => {
      const group = themeDetail?.variableSchema?.[key]?.group || 'General';
      if (!groupedVariables[group]) groupedVariables[group] = [];
      groupedVariables[group].push(key);
    });

    const themeSettingsSchema = themeDetail.settingsSchema || {};
    const groupedThemeSettings: Record<string, string[]> = {};
    const allThemeSettingKeys = Array.from(new Set([...Object.keys(themeSettingsSchema), ...Object.keys(tempSettings || {})]));
    allThemeSettingKeys.forEach((key) => {
      const group = themeSettingsSchema[key]?.group || 'General';
      if (!groupedThemeSettings[group]) groupedThemeSettings[group] = [];
      groupedThemeSettings[group].push(key);
    });

    const integrationRequirements = Array.isArray(themeDetail.integrationRequirements) ? themeDetail.integrationRequirements : [];
    const previewPalette = ThemePreviewUtils.resolvePreviewPalette({
      adminTheme: adminTheme as 'dark' | 'light',
      current: tempVariables || {},
      defaults: themeDetail.variables || {}
    });
    const livePreviewUrl = ThemePreviewUtils.normalizePreviewUrl(
      tempSettings?.previewUrl || tempSettings?.siteUrl,
      themeDetail.settingsDefaults?.previewUrl || themeDetail.settingsDefaults?.siteUrl,
      settings as Record<string, unknown> | null | undefined
    );

    return {
      adminTheme, settings, themeDetail, marketplaceVersion, loading, activeTab,
      tempVariables, tempLayouts, tempSettings,
      groupedVariables, allVarKeys, groupedThemeSettings, themeSettingsSchema, allThemeSettingKeys,
      integrationRequirements,
      previewPrimary: previewPalette.primary, previewBackground: previewPalette.background,
      previewForeground: previewPalette.foreground, previewMuted: previewPalette.muted,
      previewCard: previewPalette.card, previewAccent: previewPalette.accent,
      livePreviewUrl
    };
  }
}

import { describe, it, expect } from 'vitest';
import { ThemeMode } from '@fromcode119/core/client';
import { ThemeSettingsRenderModel } from '@/app/themes/[slug]/components/view/theme-settings-render-model.client';
import { ThemeSettingsSection } from '@/app/themes/[slug]/theme-settings-section';
import { ThemeSettingsTab } from '@/app/themes/[slug]/enums/theme-settings-tab.enum';
import type { IThemeSettingsPageView } from '@/app/themes/[slug]/interfaces/theme-settings-page-view.interface';
import type { ITheme } from '@/app/themes/[slug]/interfaces/theme.interface';

const theme = {
  slug: 'demo',
  name: 'Demo',
  version: '1.0.0',
  variableSchema: { primary: { group: 'Design' }, siteName: { group: 'General' }, footerText: { group: 'Footer Copy' } },
} as unknown as ITheme;

function page(overrides: Partial<IThemeSettingsPageView>): IThemeSettingsPageView {
  return {
    adminTheme: ThemeMode.LIGHT,
    pluginSettings: null,
    marketplaceVersion: null,
    activeTab: ThemeSettingsTab.SETTINGS,
    activeSection: '',
    tempVariables: { siteName: 'Demo', primary: '#000000', footerText: '' },
    tempDefaultLayout: '',
    tempSettings: {},
    siteStorefrontUrl: '',
    dbConfig: {},
    ...overrides,
  } as IThemeSettingsPageView;
}

describe('ThemeSettingsRenderModel sections', () => {
  it('lists one section per variable group, then the layout', () => {
    const model = ThemeSettingsRenderModel.build(page({}), theme);
    expect(model.sections.map((section) => section.id)).toEqual(['variables-general', 'variables-design', 'variables-footer-copy', ThemeSettingsSection.LAYOUT]);
  });

  /** A theme with its own settings gets an Extensions section; one without has nothing to open there. */
  it('adds the extensions section only when the theme declares settings', () => {
    const model = ThemeSettingsRenderModel.build(page({ tempSettings: { previewUrl: '' } }), theme);
    expect(model.sections.at(-1)?.id).toBe(ThemeSettingsSection.EXTENSIONS);
  });

  it('opens the section ?section= names', () => {
    expect(ThemeSettingsRenderModel.build(page({ activeSection: 'variables-design' }), theme).currentSection.variableGroup).toBe('Design');
  });

  /** A bookmark to a section the theme no longer has lands on the first one, never on nothing. */
  it('falls back to the first section for an unknown one', () => {
    expect(ThemeSettingsRenderModel.build(page({ activeSection: 'gone' }), theme).currentSection.id).toBe('variables-general');
  });
});

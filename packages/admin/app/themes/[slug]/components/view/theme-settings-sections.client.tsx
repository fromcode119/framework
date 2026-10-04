import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { ThemeSettingsTab } from '@/app/themes/[slug]/enums/theme-settings-tab.enum';
import { ThemeSettingsSection } from '@/app/themes/[slug]/theme-settings-section';
import type { IThemeSettingsPageView } from '@/app/themes/[slug]/interfaces/theme-settings-page-view.interface';
import { ThemeSettingsRenderModel } from '@/app/themes/[slug]/components/view/theme-settings-render-model.client';
import { ThemeSettingsVariablesPanel } from '@/app/themes/[slug]/components/view/theme-settings-variables-panel.client';
import { ThemeSettingsLayoutsPanel } from '@/app/themes/[slug]/components/view/theme-settings-layouts-panel.client';
import { ThemeSettingsExtensionsPanel } from '@/app/themes/[slug]/components/view/theme-settings-extensions-panel.client';

/**
 * The Settings tab: a second, quieter row of the theme's sections (the plugin settings' style), then the
 * open section. Edits in every section are kept until the header's Save sends them together.
 */
export class ThemeSettingsSections extends PureReactor {
  /** JSX props — the declared @prop fields, so call sites are type-checked without a <Props> generic. */
  declare props: Pick<ThemeSettingsSections, 'page' | 'model'>;

  @prop declare page: IThemeSettingsPageView;
  @prop declare model: ThemeSettingsRenderModel;

  private content(section: ThemeSettingsSection): ReactNode {
    const { page, model } = this;
    if (section.variableGroup !== null) return <ThemeSettingsVariablesPanel page={page} model={model} group={section.variableGroup} />;
    if (section.id === ThemeSettingsSection.EXTENSIONS) return <ThemeSettingsExtensionsPanel page={page} model={model} />;
    return <ThemeSettingsLayoutsPanel page={page} model={model} />;
  }

  render(): ReactNode {
    const { sections, currentSection, adminTheme } = this.model;
    const dark = adminTheme === ThemeMode.DARK;
    return (
      <>
        <div className={`flex gap-6 overflow-x-auto [scrollbar-width:none] border-b px-6 text-[12.5px] ${dark ? 'border-slate-800 bg-slate-950/60' : 'border-slate-200 bg-slate-50'}`}>
          {sections.map((section) => (
            <button type="button" key={section.id} onClick={() => this.page.handleTabChange(ThemeSettingsTab.SETTINGS, section.id)}
              aria-current={section === currentSection ? 'page' : undefined}
              className={`-mb-px whitespace-nowrap border-b-2 py-2.5 transition-colors ${section === currentSection
                ? (dark ? 'border-indigo-300 text-white' : 'border-indigo-500 text-slate-900')
                : (dark ? 'border-transparent text-slate-400 hover:text-slate-200' : 'border-transparent text-slate-500 hover:text-slate-800')}`}>
              {section.label}
            </button>
          ))}
        </div>
        <div className="space-y-4 p-6">
          <h2 className={`text-base font-semibold ${dark ? 'text-white' : 'text-slate-900'}`}>{currentSection.label}</h2>
          {this.content(currentSection)}
        </div>
      </>
    );
  }
}

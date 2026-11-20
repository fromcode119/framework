import { Tabs } from '@/components/ui/view/tabs.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
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
    const { sections, currentSection } = this.model;
    return (
      <>
        <Tabs variant="second" label={AdminI18n.t('themes.settings')} value={currentSection.id}
          tabs={sections.map((section) => ({ id: section.id, label: section.label }))}
          onChange={(id: string) => this.page.handleTabChange(ThemeSettingsTab.SETTINGS, id)} />
        <div className="w-full py-6">
          <section className="rounded-2xl border fc-tone-line fc-tone-surface p-6 shadow-sm fc-page-stack">
            <h2 className={`text-base font-medium fc-tone-text`}>{currentSection.label}</h2>
            {this.content(currentSection)}
          </section>
        </div>
      </>
    );
  }
}

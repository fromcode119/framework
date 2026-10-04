import { ThemeSettingsTab } from '@/app/themes/[slug]/enums/theme-settings-tab.enum';
import { ThemeMode, ThemeState } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/view/badge.client';
import { FrameworkIcons } from '@fromcode119/react';
import { PureReactor, bound, prop } from '@fromcode119/react-class-components';
import type { IThemeSettingsPageView } from '@/app/themes/[slug]/interfaces/theme-settings-page-view.interface';
import { ThemeSettingsRenderModel } from '@/app/themes/[slug]/components/view/theme-settings-render-model.client';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * The theme page's header: where you are, which theme, its state and version — and its actions: open the
 * site it styles, and on the Settings tab save the edits.
 */
export class ThemeSettingsHeader extends PureReactor {
  /** JSX props — the declared @prop fields, so call sites are type-checked without a <Props> generic. */
  declare props: Pick<ThemeSettingsHeader, 'page' | 'model'>;

  @prop declare page: IThemeSettingsPageView;
  @prop declare model: ThemeSettingsRenderModel;

  @bound private save(): void {
    void this.page.handleSaveConfig();
  }

  private openSite(dark: boolean): ReactNode {
    const url = this.model.livePreviewUrl;
    if (!url) return null;
    return (
      <a href={url} target="_blank" rel="noreferrer"
        className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3.5 text-[13px] font-medium transition-colors ${dark ? 'border-slate-700 text-slate-200 hover:bg-slate-800' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
        <FrameworkIcons.External size={14} />
        {AdminI18n.t('themes.openSite')}
      </a>
    );
  }

  render(): ReactNode {
    const { themeDetail, adminTheme } = this.model;
    const { activeTab, isSaving } = this.page;
    const dark = adminTheme === ThemeMode.DARK;
    const active = themeDetail.state === ThemeState.ACTIVE;
    return (
      <div>
        <div className={`mb-2 flex items-center gap-1.5 text-xs ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
          <Link href={AdminConstants.ROUTES.THEMES.INSTALLED} className={`hover:underline ${dark ? 'hover:text-slate-300' : 'hover:text-slate-600'}`}>{AdminI18n.t('themes.installed')}</Link>
          <span>/</span>
          <span>{themeDetail.name}</span>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${dark ? 'bg-indigo-500/15 text-indigo-300' : 'bg-indigo-50 text-indigo-600'}`}>
            <FrameworkIcons.Palette size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className={`truncate text-xl font-bold tracking-tight ${dark ? 'text-white' : 'text-slate-900'}`}>{themeDetail.name}</h1>
            {/* Words, never the member: `themeDetail.state` is a `ThemeState` Enum, and an Enum handed to
                React as a child is an object — it threw "Minified React error #31" and blanked the page. */}
            <div className={`mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
              <Badge variant={active ? 'success' : 'gray'}>{AdminI18n.t(active ? 'themes.active' : 'themes.inactive')}</Badge>
              <span>v{themeDetail.version}</span>
              {themeDetail.author ? <><span>·</span><span>{themeDetail.author}</span></> : null}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {this.openSite(dark)}
            {activeTab === ThemeSettingsTab.SETTINGS ? (
              <button type="button" onClick={this.save} disabled={isSaving}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-indigo-600 bg-indigo-600 px-4 text-[13px] font-semibold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50">
                {isSaving ? <FrameworkIcons.Loader size={14} className="animate-spin" /> : <FrameworkIcons.Check size={14} />}
                {AdminI18n.t('themes.saveChanges')}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    );
  }
}

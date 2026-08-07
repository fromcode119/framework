import { ThemeSettingsTab } from '@/app/themes/[slug]/enums/theme-settings-tab.enum';
import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/view/badge.client';
import { FrameworkIcons } from '@fromcode119/react';
import { ThemeState } from '@fromcode119/core/client';
import { Reactor, prop } from '@fromcode119/reactor';
import type { IThemeSettingsPageView } from '@/app/themes/[slug]/interfaces/theme-settings-page-view.interface';
import { ThemeSettingsRenderModel } from '@/app/themes/[slug]/components/view/theme-settings-render-model.client';

export class ThemeSettingsHeader extends Reactor {
  /** JSX props — the declared @prop fields, so call sites are type-checked without a <Props> generic. */
  declare props: Pick<ThemeSettingsHeader, 'page' | 'model'>;

  @prop declare page: IThemeSettingsPageView;
  @prop declare model: ThemeSettingsRenderModel;

  render(): ReactNode {
    const page = this.page;
    const model = this.model;
    const { adminTheme, themeDetail, marketplaceVersion } = model;
    const { activeTab, isUpdating, isSaving } = page;
    return (
      <div className="flex items-center gap-4">
        <Link
          href="/themes"
          className={`h-9 w-9 rounded-lg flex items-center justify-center transition-all duration-300 shadow-sm ${adminTheme === ThemeMode.DARK ? 'bg-slate-900 text-slate-400 hover:text-white ring-1 ring-white/10' : 'bg-white text-slate-500 hover:text-indigo-600 hover:shadow-md'}`}
        >
          <FrameworkIcons.Left size={18} strokeWidth={2.5} />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h1 className={`text-xl font-bold tracking-tight truncate ${adminTheme === ThemeMode.DARK ? 'text-white' : 'text-slate-900'}`}>
              {themeDetail.name}
            </h1>
            {/* `.value`, not the member: the controller hydrates `themeDetail.state` into a `ThemeState`
                at the fetch boundary, and an Enum handed to React as a child is an object — it threw
                "Minified React error #31 … object with keys {value}" and blanked the whole page. */}
            <Badge variant={themeDetail.state === ThemeState.ACTIVE ? 'success' : 'gray'}>
              {themeDetail.state.value}
            </Badge>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-lg ${adminTheme === ThemeMode.DARK ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>{themeDetail.slug}</span>
            <span className="text-slate-500 opacity-30">•</span>
            <span className={`text-[11px] font-semibold uppercase tracking-wide ${marketplaceVersion && marketplaceVersion !== themeDetail.version ? 'text-amber-500' : 'text-slate-400'}`}>
              Version {themeDetail.version}
            </span>
            {marketplaceVersion && marketplaceVersion !== themeDetail.version && (
              <button
                onClick={() => void page.handleUpdate()}
                disabled={isUpdating}
                className="ml-3 px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-semibold uppercase tracking-wide rounded-lg transition-all flex items-center gap-1.5 shadow-lg shadow-indigo-600/20"
              >
                {isUpdating ? <FrameworkIcons.Loader size={10} className="animate-spin" /> : <FrameworkIcons.Zap size={10} />}
                {isUpdating ? 'Updating...' : 'Update Available'}
              </button>
            )}
          </div>
        </div>

        {activeTab === ThemeSettingsTab.SETTINGS && (
          <button
            onClick={() => void page.handleSaveConfig()}
            disabled={isSaving}
            className={`h-9 px-4 rounded-lg flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide transition-all duration-300 shadow-sm active:scale-95 disabled:opacity-50 ${adminTheme === ThemeMode.DARK ? 'bg-indigo-600 text-white hover:bg-indigo-500' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
          >
            {isSaving ? <FrameworkIcons.Loader size={16} className="animate-spin" /> : <FrameworkIcons.Zap size={16} />}
            Apply Architecture Update
          </button>
        )}
      </div>
    );
  }
}

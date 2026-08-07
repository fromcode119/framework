import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { Reactor, prop } from '@fromcode119/reactor';
import { Card } from '@/components/ui/view/card.client';
import { Badge } from '@/components/ui/view/badge.client';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { ThemeState } from '@fromcode119/core/client';
import { AdminClass } from '@/lib/admin-class';
import type { IThemeSettingsPageView } from '@/app/themes/[slug]/interfaces/theme-settings-page-view.interface';
import { ThemeSettingsRenderModel } from '@/app/themes/[slug]/components/view/theme-settings-render-model.client';

export class ThemeSettingsSidebar extends Reactor {
  /** JSX props — the declared @prop fields, so call sites are type-checked without a <Props> generic. */
  declare props: Pick<ThemeSettingsSidebar, 'page' | 'model'>;

  @prop declare page: IThemeSettingsPageView;
  @prop declare model: ThemeSettingsRenderModel;

  render(): ReactNode {
    const page = this.page;
    const model = this.model;
    const { adminTheme, themeDetail, marketplaceVersion, integrationRequirements, livePreviewUrl } = model;
    const { previewSwatches } = model;
    const { isUpdating, isReseeding, isResettingTheme } = page;
    return (
      <div className="space-y-6">
        <Card className={`border-0 p-4 ${AdminClass.SURFACE} ${adminTheme === ThemeMode.DARK ? 'bg-slate-900/40' : 'bg-white shadow-sm'}`}>
          <h3 className={`text-[10px] font-semibold uppercase tracking-[0.15em] mb-4 ${adminTheme === ThemeMode.DARK ? 'text-slate-500' : 'text-slate-400'}`}>
            Metadata Artifacts
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Architect</span>
              <span className={`text-[11px] font-semibold uppercase tracking-wider ${adminTheme === ThemeMode.DARK ? 'text-indigo-400' : 'text-indigo-600'}`}>
                {themeDetail.author || 'Fromcode Official'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Marketplace Version</span>
              <span className={`text-[11px] font-semibold ${adminTheme === ThemeMode.DARK ? 'text-white' : 'text-slate-900'}`}>
                v{themeDetail.version}
              </span>
            </div>
          </div>

          {marketplaceVersion && marketplaceVersion !== themeDetail.version && (
            <div className={`mt-4 pt-4 border-t ${adminTheme === ThemeMode.DARK ? 'border-slate-800' : 'border-slate-100'}`}>
              <button
                onClick={() => void page.handleUpdate()}
                disabled={isUpdating}
                className="w-full h-9 bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-semibold uppercase tracking-wide rounded-lg transition-all shadow-sm flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
              >
                <FrameworkIcons.Clock size={14} />
                {isUpdating ? 'Synchronizing...' : `Upgrade to v${marketplaceVersion}`}
              </button>
            </div>
          )}
        </Card>

        <Card className={`border-0 p-4 ${AdminClass.SURFACE} overflow-hidden relative ${adminTheme === ThemeMode.DARK ? 'bg-slate-900/40' : 'bg-white shadow-sm'}`}>
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className={`text-[10px] font-semibold uppercase tracking-[0.15em] ${adminTheme === ThemeMode.DARK ? 'text-slate-500' : 'text-slate-400'}`}>
              Theme Colors
            </h3>
            <a
              href={livePreviewUrl}
              target="_blank"
              rel="noreferrer"
              className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide transition ${adminTheme === ThemeMode.DARK ? 'bg-white/10 text-slate-200 hover:bg-white/15' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
            >
              <FrameworkIcons.ExternalLink size={11} />
              Open Site
            </a>
          </div>
          {previewSwatches.length === 0 ? (
            <p className="text-[10px] font-semibold leading-relaxed text-slate-500">
              This theme declares no color variables, so there is nothing to preview.
            </p>
          ) : (
            <div className="space-y-1.5">
              {previewSwatches.map((swatch) => (
                <div
                  key={swatch.key}
                  className={`flex items-center gap-2.5 rounded-lg border px-2.5 py-1.5 ${adminTheme === ThemeMode.DARK ? 'bg-slate-800/30 border-white/5' : 'bg-slate-50 border-slate-100'}`}
                >
                  <span
                    className={`h-6 w-6 shrink-0 rounded-md border ${adminTheme === ThemeMode.DARK ? 'border-white/10' : 'border-slate-200'}`}
                    style={{ backgroundColor: swatch.value }}
                  />
                  <span className="min-w-0 flex-1 truncate text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    {swatch.label}
                  </span>
                  <span className={`shrink-0 font-mono text-[10px] font-semibold uppercase ${adminTheme === ThemeMode.DARK ? 'text-slate-300' : 'text-slate-700'}`}>
                    {swatch.value}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className={`border-0 p-4 ${AdminClass.SURFACE} ${adminTheme === ThemeMode.DARK ? 'bg-slate-900/40' : 'bg-white shadow-sm'}`}>
          <h3 className={`text-[10px] font-semibold uppercase tracking-[0.15em] mb-4 ${adminTheme === ThemeMode.DARK ? 'text-slate-500' : 'text-slate-400'}`}>
            Theme Maintenance
          </h3>
          <div className="space-y-3">
            <button
              onClick={() => page.openRunSeedsConfirm()}
              disabled={isReseeding || isResettingTheme}
              className="w-full h-9 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-semibold uppercase tracking-wide rounded-lg transition-all shadow-sm flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
            >
              {isReseeding ? <FrameworkIcons.Loader size={14} className="animate-spin" /> : <FrameworkIcons.Refresh size={14} />}
              {isReseeding ? 'Running Seeds...' : 'Run Seeds'}
            </button>
            <button
              onClick={() => page.openResetThemeConfirm()}
              disabled={isReseeding || isResettingTheme}
              className="w-full h-9 bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-semibold uppercase tracking-wide rounded-lg transition-all shadow-sm flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
            >
              {isResettingTheme ? <FrameworkIcons.Loader size={14} className="animate-spin" /> : <FrameworkIcons.Warning size={14} />}
              {isResettingTheme ? 'Resetting Theme...' : 'Reset Theme + Seeds'}
            </button>
          </div>
          <p className={`mt-4 text-[10px] font-bold leading-relaxed ${adminTheme === ThemeMode.DARK ? 'text-slate-500' : 'text-slate-400'}`}>
            Run Seeds replays theme seed data. Reset Theme + Seeds clears saved theme config and replays seeds.
          </p>
        </Card>

        {integrationRequirements.length > 0 && (
          <Card className={`border-0 p-4 ${AdminClass.SURFACE} ${adminTheme === ThemeMode.DARK ? 'bg-slate-900/40' : 'bg-white shadow-sm'}`}>
            <h3 className={`text-[10px] font-semibold uppercase tracking-[0.15em] mb-4 ${adminTheme === ThemeMode.DARK ? 'text-slate-500' : 'text-slate-400'}`}>
              Integration Requirements
            </h3>
            <div className="space-y-3">
              {integrationRequirements.map((integration) => (
                <div key={integration.type} className={`p-4 rounded-xl border ${adminTheme === ThemeMode.DARK ? 'bg-slate-800/40 border-white/10' : 'bg-slate-50 border-slate-100'}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className={`text-[11px] font-semibold uppercase tracking-wide ${adminTheme === ThemeMode.DARK ? 'text-white' : 'text-slate-900'}`}>
                        {integration.label || integration.type}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-1">
                        {integration.description || `Configure ${integration.type} integration for this theme.`}
                      </p>
                    </div>
                    <Badge variant={integration.required === false ? 'gray' : 'warning'}>
                      {integration.required === false ? 'Optional' : 'Required'}
                    </Badge>
                  </div>
                  <div className="mt-3">
                    <Link href={AdminConstants.ROUTES.SETTINGS.INTEGRATIONS_BY_TYPE(integration.type)} className="text-[10px] font-semibold uppercase tracking-wide text-indigo-500 hover:text-indigo-600">
                      Open Integration Settings
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        <Card className={`border-0 p-4 rounded-xl ${adminTheme === ThemeMode.DARK ? 'bg-red-500/10 border border-red-500/20 shadow-sm' : 'bg-red-50 border border-red-100 shadow-sm'}`}>
          <div className="flex items-center gap-3 mb-4">
            <FrameworkIcons.Warning size={18} className="text-red-500" />
            <h3 className={`text-[10px] font-semibold uppercase tracking-[0.15em] ${adminTheme === ThemeMode.DARK ? 'text-red-400' : 'text-red-600'}`}>
              System Purge
            </h3>
          </div>
          <p className={`text-[11px] font-bold leading-relaxed mb-4 ${adminTheme === ThemeMode.DARK ? 'text-red-300/70' : 'text-red-700/70'}`}>
            {themeDetail.state === ThemeState.ACTIVE
              ? 'This theme is currently active. On delete, the system will switch to another theme if available, or continue with no active theme.'
              : 'Removing this theme artifact is permanent. All local layout variations will be destroyed.'}
          </p>
          <button
            onClick={() => page.openDeleteConfirm()}
            className="w-full h-9 bg-slate-900 dark:bg-white dark:text-slate-900 text-white text-[10px] font-semibold uppercase tracking-wide rounded-lg transition-all shadow-sm hover:bg-red-600 hover:text-white dark:hover:bg-red-600 dark:hover:text-white"
          >
            {themeDetail.state === ThemeState.ACTIVE ? 'Switch & Destroy Theme' : 'Destroy Theme'}
          </button>
        </Card>
      </div>
    );
  }
}

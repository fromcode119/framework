import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { Card } from '@/components/ui/view/card.client';
import { Select } from '@/components/ui/view/select.client';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminClass } from '@/lib/admin-class';
import type { IThemeSettingsPageView } from '@/app/themes/[slug]/interfaces/theme-settings-page-view.interface';
import { ThemeSettingsRenderModel } from '@/app/themes/[slug]/components/view/theme-settings-render-model.client';

export class ThemeSettingsLayoutsPanel extends PureReactor {
  /** JSX props — the declared @prop fields, so call sites are type-checked without a <Props> generic. */
  declare props: Pick<ThemeSettingsLayoutsPanel, 'page' | 'model'>;

  @prop declare page: IThemeSettingsPageView;
  @prop declare model: ThemeSettingsRenderModel;

  render(): ReactNode {
    const page = this.page;
    const { adminTheme, themeDetail, tempDefaultLayout, allVarKeys } = this.model;
    const layouts = themeDetail.layouts || [];
    const themeDefault = layouts.find((l) => l.name === themeDetail.defaultLayout);
    const themeDefaultLabel = themeDefault?.label || themeDetail.defaultLayout || '';
    // A saved choice the theme no longer declares is not applied by the storefront — say so here
    // instead of showing a select that looks set but does nothing.
    const isUnavailable = Boolean(tempDefaultLayout) && !layouts.some((l) => l.name === tempDefaultLayout);
    const selected = layouts.find((l) => l.name === (tempDefaultLayout || themeDetail.defaultLayout));
    return (
      <>
        <Card className={`border-0 p-5 ${AdminClass.SURFACE} ${adminTheme === ThemeMode.DARK ? 'bg-slate-900/40' : 'bg-white shadow-xl shadow-slate-200/50'}`}>
          <div className="flex items-center gap-3 mb-5">
            <div className="h-10 w-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-500">
              <FrameworkIcons.Box size={20} />
            </div>
            <div>
              <h3 className={`text-[11px] font-semibold uppercase tracking-wide ${adminTheme === ThemeMode.DARK ? 'text-white' : 'text-slate-900'}`}>
                Default Layout
              </h3>
              <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-tight mt-1">Layout for pages that do not choose their own.</p>
            </div>
          </div>

          <div className={`flex flex-col p-5 rounded-xl border ${adminTheme === ThemeMode.DARK ? 'bg-slate-800/30 border-white/5' : 'bg-white border-slate-100 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.02)]'}`}>
            <Select
              value={tempDefaultLayout}
              onChange={(nextValue) => page.handleDefaultLayoutChange(String(nextValue || ''))}
              options={[
                { value: '', label: themeDefaultLabel ? `Theme default (${themeDefaultLabel})` : 'Theme default (none declared)' },
                ...(isUnavailable ? [{ value: tempDefaultLayout, label: `${tempDefaultLayout} (not in this theme)` }] : []),
                ...layouts.map((l) => ({ value: l.name, label: l.label })),
              ]}
              searchable={false}
              theme={adminTheme}
              className="w-full"
            />
            {selected?.description ? (
              <p className="text-[11px] text-slate-500 mt-2">{selected.description}</p>
            ) : null}
            {isUnavailable ? (
              <p className="text-[11px] text-amber-600 mt-2">
                This theme no longer provides &ldquo;{tempDefaultLayout}&rdquo;, so pages use the theme default until you choose another.
              </p>
            ) : null}
            <p className="text-[11px] text-slate-500 mt-2">
              A page that picks a layout in its own Layout field keeps that layout.
            </p>
          </div>
        </Card>

        {themeDetail.overrides && themeDetail.overrides.length > 0 && (
          <Card className={`border-0 p-5 ${AdminClass.SURFACE} ${adminTheme === ThemeMode.DARK ? 'bg-slate-900/40' : 'bg-white shadow-xl shadow-slate-200/50'}`}>
            <div className="flex items-center gap-3 mb-5">
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
                <FrameworkIcons.Zap size={20} />
              </div>
              <div>
                <h3 className={`text-[11px] font-semibold uppercase tracking-wide ${adminTheme === ThemeMode.DARK ? 'text-white' : 'text-slate-900'}`}>
                  UI Overrides
                </h3>
                <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-tight mt-1">Components hard-coded for replacement by this theme.</p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {themeDetail.overrides.map((o) => (
                <div key={o.name} className={`p-5 rounded-xl border flex items-center gap-3 ${adminTheme === ThemeMode.DARK ? 'bg-slate-800/30 border-white/5' : 'bg-slate-50/50 border-slate-100 shadow-sm'}`}>
                  <div className="h-6 w-6 rounded-full bg-amber-500/20 flex items-center justify-center">
                    <div className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                  </div>
                  <div className={`text-[10px] font-semibold uppercase tracking-wide ${adminTheme === ThemeMode.DARK ? 'text-slate-300' : 'text-slate-700'}`}>
                    {o.name}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {!allVarKeys.length && (
          <Card className={`border-0 p-12 flex flex-col items-center justify-center ${AdminClass.SURFACE} ${adminTheme === ThemeMode.DARK ? 'bg-slate-900/40' : 'bg-white'}`}>
            <FrameworkIcons.Help size={32} className="text-slate-300 mb-4" />
            <p className="text-slate-500 font-semibold uppercase tracking-wide text-[10px]">No configurable protocols found</p>
          </Card>
        )}
      </>
    );
  }
}

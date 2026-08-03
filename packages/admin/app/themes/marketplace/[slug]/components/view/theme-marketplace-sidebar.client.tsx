import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/reactor';
import type { IMarketplaceTheme } from '@fromcode119/core/client';
import { Card } from '@/components/ui/view/card.client';
import { FrameworkIcons } from '@fromcode119/react';
import { ThemeMarketplaceDependencyCard } from '@/app/themes/marketplace/[slug]/components/view/theme-marketplace-dependency-card.client';
import { ThemeMarketplaceVerifiedCard } from '@/app/themes/marketplace/[slug]/components/view/theme-marketplace-verified-card.client';
import { AdminClass } from '@/lib/admin-class';

export class ThemeMarketplaceSidebar extends PureReactor {
  @prop declare theme: IMarketplaceTheme;
  @prop declare adminTheme: ThemeMode;
  @prop declare installedTheme: any | null;
  @prop declare installedVersion: string | null;
  @prop declare hasUpdate: boolean;
  @prop declare installing: boolean;
  @prop declare onInstall: () => void;

  render(): ReactNode {
    const { theme, adminTheme, installedTheme, installedVersion, hasUpdate, installing, onInstall } = this;
    return (
      <div className="space-y-6">
        <ThemeMarketplaceDependencyCard theme={theme} adminTheme={adminTheme} />

        <Card className={`border-0 p-4 ${AdminClass.SURFACE} ${adminTheme === ThemeMode.DARK ? 'bg-slate-900/40' : 'bg-white shadow-sm'}`}>
          {hasUpdate && (
            <div className={`mb-4 p-4 rounded-xl border flex items-start gap-3 animate-in fade-in slide-in-from-top-4 duration-500 ${
              adminTheme === ThemeMode.DARK ? 'bg-amber-500/10 border-amber-500/20' : 'bg-amber-50 border-amber-100'
            }`}>
              <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                <FrameworkIcons.Clock className="text-amber-600" size={18} />
              </div>
              <div>
                <h4 className={`text-sm font-bold uppercase tracking-wider leading-tight ${adminTheme === ThemeMode.DARK ? 'text-amber-400' : 'text-amber-900'}`}>Upgrade Available</h4>
                <p className={`text-[11px] font-semibold mt-1 leading-relaxed ${adminTheme === ThemeMode.DARK ? 'text-amber-500/70' : 'text-amber-700'}`}>
                  v{theme.version} brings new design improvements and features.
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-col items-center text-center">
            <div className={`h-16 w-16 rounded-xl mb-4 shadow-sm overflow-hidden ring-2 ring-offset-2 ${adminTheme === ThemeMode.DARK ? 'ring-indigo-500/20 ring-offset-slate-900' : 'ring-indigo-100 ring-offset-white'}`}>
              {theme.iconUrl ? (
                <img src={theme.iconUrl} alt={theme.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-indigo-600 flex items-center justify-center text-white">
                  <FrameworkIcons.Palette size={24} />
                </div>
              )}
            </div>

            <div className="w-full pb-4 mb-4 border-b border-slate-100 dark:border-white/5">
              <div className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${adminTheme === ThemeMode.DARK ? 'text-slate-500' : 'text-slate-400'}`}>Installed Release</div>
              <div className={`text-lg font-bold ${adminTheme === ThemeMode.DARK ? 'text-white' : 'text-slate-900'}`}>{installedVersion ? `v${installedVersion}` : 'Not installed'}</div>
            </div>

            <div className="w-full pb-4 mb-4 border-b border-slate-100 dark:border-white/5">
              <div className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${adminTheme === ThemeMode.DARK ? 'text-slate-500' : 'text-slate-400'}`}>Marketplace Release</div>
              <div className={`text-lg font-bold ${adminTheme === ThemeMode.DARK ? 'text-white' : 'text-slate-900'}`}>v{theme.version}</div>
            </div>

            <div className="w-full space-y-4">
              <div className="flex justify-between items-center group cursor-default">
                <div className="flex items-center gap-3">
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${adminTheme === ThemeMode.DARK ? 'bg-slate-800 text-slate-400' : 'bg-slate-50 text-slate-400'}`}>
                    <FrameworkIcons.User size={14} />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Creator</span>
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-widest ${adminTheme === ThemeMode.DARK ? 'text-indigo-400' : 'text-indigo-600'}`}>{theme.author}</span>
              </div>

              <div className="flex justify-between items-center group cursor-default">
                <div className="flex items-center gap-3">
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${adminTheme === ThemeMode.DARK ? 'bg-slate-800 text-slate-400' : 'bg-slate-50 text-slate-400'}`}>
                    <FrameworkIcons.Layout size={14} />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Category</span>
                </div>
                <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-[10px] font-bold uppercase tracking-widest rounded-lg">UI Framework</span>
              </div>

              {theme.authorUrl && (
                <a href={theme.authorUrl} target="_blank" className="flex justify-between items-center group pt-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 group-hover:text-indigo-600 transition-colors">Developer Portal</span>
                  <FrameworkIcons.External size={14} className="opacity-40 group-hover:opacity-100 transition-opacity" />
                </a>
              )}
            </div>

            <button
              disabled={installing || (installedTheme && !hasUpdate)}
              onClick={onInstall}
              className={`w-full mt-4 h-9 rounded-lg font-bold text-[11px] uppercase tracking-widest shadow-sm transition-all duration-300 flex items-center justify-center gap-2 active:scale-95 ${
                installedTheme && !hasUpdate
                  ? 'bg-emerald-50 text-emerald-600 cursor-default opacity-80 shadow-none'
                  : hasUpdate
                  ? 'bg-amber-600 hover:bg-amber-700 text-white'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
              }`}
            >
              {installing ? (
                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : installedTheme && !hasUpdate ? (
                <>
                  <FrameworkIcons.Check size={18} strokeWidth={2.5} />
                  Installed
                </>
              ) : hasUpdate ? (
                <>
                  <FrameworkIcons.Clock size={18} strokeWidth={2.5} />
                  Update Now
                </>
              ) : (
                <>
                  <FrameworkIcons.Download size={18} strokeWidth={2.5} />
                  Install Theme
                </>
              )}
            </button>
          </div>
        </Card>

        <ThemeMarketplaceVerifiedCard adminTheme={adminTheme} />
      </div>
    );
  }
}

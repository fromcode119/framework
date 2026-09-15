import { ThemeMode } from '@fromcode119/core/client';
import type { MouseEvent, ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import type { IPluginEntry } from '@fromcode119/core/client';

export class MarketplaceCardActions extends PureReactor {
  @prop declare plugin: IPluginEntry;
  @prop declare theme: ThemeMode;
  @prop declare installed: any | undefined;
  @prop declare installedVersion: string | null;
  @prop declare hasUpdate: boolean;
  @prop declare installing: string | null;
  @prop declare onOpenInstalled: (e: MouseEvent) => void;
  @prop declare onInstall: (e: MouseEvent) => void;
  /**
   * May THIS admin actually install onto the platform?
   *
   * A site administrator may browse the catalogue — a site on this platform behaves like its own
   * installation, so it has a marketplace — but installing a plugin puts code on the container every
   * customer shares, and `PLUGINS_INSTALL` answers `platform_admin_required`. Rendering the button
   * anyway would be a control that cannot act, so the card says who can instead.
   *
   * This is a plugin-only limitation: a site installs a THEME into its own directory, so that button
   * has somewhere real to go.
   */
  @prop declare canInstall: boolean;

  render(): ReactNode {
    const { plugin, theme, installed, installedVersion, hasUpdate, installing, onOpenInstalled, onInstall, canInstall } = this;
    return (
      <div className="px-4 pb-4 space-y-3">
        {installed && hasUpdate && (
          <div className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${theme === ThemeMode.DARK ? 'bg-amber-500/10 border-amber-500/20' : 'bg-amber-50 border-amber-100 shadow-sm'}`}>
            <div className="h-2 w-2 rounded-full bg-amber-500 animate-ping" />
            <span className={`text-[10px] font-bold uppercase tracking-wide leading-none ${theme === ThemeMode.DARK ? 'text-amber-400' : 'text-amber-700'}`}>Update {installedVersion} to {plugin.version}</span>
          </div>
        )}

        <div className="flex items-center gap-3">
          {installed && !hasUpdate ? (
            <button
              onClick={onOpenInstalled}
              className={`w-full flex items-center justify-center gap-2.5 h-9 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all ${theme === ThemeMode.DARK ? 'bg-slate-800 text-slate-400 hover:text-white' : 'bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600'}`}
            >
              <FrameworkIcons.Check size={16} />
              <span>Installed</span>
            </button>
          ) : hasUpdate && canInstall ? (
            <button
              onClick={onInstall}
              disabled={!!installing}
              className={`w-full flex items-center justify-center gap-2.5 h-9 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all shadow-sm active:scale-[0.97] bg-amber-600 text-white hover:bg-amber-700 ${installing === plugin.slug ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              <FrameworkIcons.Loader size={16} className="animate-spin" />
              <span>{installing === plugin.slug ? 'Updating...' : 'Update Plugin'}</span>
            </button>
          ) : !canInstall ? (
            <div
              className={`w-full flex items-center justify-center gap-2.5 h-9 rounded-lg text-[10px] font-semibold uppercase tracking-wide ${theme === ThemeMode.DARK ? 'bg-slate-800/60 text-slate-500' : 'bg-slate-50 text-slate-400'}`}
              title="Installing a plugin puts code on the container every site shares, so a platform admin does it. Ask yours to add this to your site."
            >
              <FrameworkIcons.Shield size={14} />
              <span>Platform admin installs this</span>
            </div>
          ) : (
            <button
              onClick={onInstall}
              disabled={!!installing}
              className={`w-full flex items-center justify-center gap-2.5 h-9 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all shadow-sm active:scale-[0.97] bg-indigo-600 text-white hover:bg-indigo-700 ${installing === plugin.slug ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {installing === plugin.slug ? (
                <FrameworkIcons.Loader size={16} className="animate-spin" />
              ) : (
                <FrameworkIcons.Download size={16} />
              )}
              <span>{installing === plugin.slug ? 'Installing...' : 'Install Now'}</span>
            </button>
          )}
        </div>
      </div>
    );
  }
}

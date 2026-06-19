"use client";

import React from 'react';
import { FrameworkIcons } from '@fromcode119/react';
import type { MarketplaceCardActionsProps } from './marketplace-card-actions.types';

export class MarketplaceCardActions extends React.Component<MarketplaceCardActionsProps> {
  render(): React.ReactNode {
    const { plugin, theme, installed, installedVersion, hasUpdate, installing, onOpenInstalled, onInstall } = this.props;
    return (
      <div className="px-8 pb-8 space-y-4">
        {installed && hasUpdate && (
          <div className={`flex items-center gap-3 p-4 rounded-2xl border transition-all ${theme === 'dark' ? 'bg-amber-500/10 border-amber-500/20' : 'bg-amber-50 border-amber-100 shadow-sm'}`}>
            <div className="h-2 w-2 rounded-full bg-amber-500 animate-ping" />
            <span className={`text-[10px] font-bold uppercase tracking-wide leading-none ${theme === 'dark' ? 'text-amber-400' : 'text-amber-700'}`}>Update {installedVersion} to {plugin.version}</span>
          </div>
        )}

        <div className="flex items-center gap-3">
          {installed && !hasUpdate ? (
            <button
              onClick={onOpenInstalled}
              className={`w-full flex items-center justify-center gap-2.5 py-3 rounded-xl text-[10px] font-bold uppercase tracking-wide transition-all ${theme === 'dark' ? 'bg-slate-800 text-slate-400 hover:text-white' : 'bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600'}`}
            >
              <FrameworkIcons.Check size={16} />
              <span>Installed</span>
            </button>
          ) : hasUpdate ? (
            <button
              onClick={onInstall}
              disabled={!!installing}
              className={`w-full flex items-center justify-center gap-2.5 py-3 rounded-xl text-[10px] font-bold uppercase tracking-wide transition-all shadow-lg active:scale-[0.97] bg-amber-600 text-white hover:bg-amber-700 shadow-amber-600/20 hover:-translate-y-1 ${installing === plugin.slug ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              <FrameworkIcons.Loader size={16} className="animate-spin" />
              <span>{installing === plugin.slug ? 'Updating...' : 'Update Plugin'}</span>
            </button>
          ) : (
            <button
              onClick={onInstall}
              disabled={!!installing}
              className={`w-full flex items-center justify-center gap-2.5 py-3 rounded-xl text-[10px] font-bold uppercase tracking-wide transition-all shadow-lg active:scale-[0.97] bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-600/20 hover:-translate-y-1 ${installing === plugin.slug ? 'opacity-70 cursor-not-allowed' : ''}`}
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

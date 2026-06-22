"use client";

import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FrameworkIcons } from '@fromcode119/react';
import { MarketplaceCardActions } from './marketplace-card-actions';
import type { MarketplacePluginCardProps } from './marketplace-card.interfaces';

export class MarketplacePluginCard extends React.Component<MarketplacePluginCardProps> {
  render(): React.ReactNode {
    const {
      plugin, theme, installed, installedVersion, hasUpdate, hasImageError, installing,
      onOpenDetail, onOpenInstalled, onInstall, onImageError
    } = this.props;
    const isFeatured = Boolean(plugin.isFeatured);
    const isVerified = Boolean(plugin.isVerified);
    const isTrending = Boolean(plugin.isTrending);

    return (
      <Card
        onClick={onOpenDetail}
        className={`group flex flex-col h-full border-0 relative transition-all duration-300 cursor-pointer overflow-hidden rounded-xl ${theme === 'dark' ? 'bg-slate-900/40 hover:bg-slate-900/60 ring-1 ring-white/5' : 'bg-white shadow-sm hover:shadow-indigo-500/10'}`}
      >
        <div className="p-3.5 space-y-3 flex-1 relative">
          <div className="flex items-start justify-between gap-3">
            <div className={`h-10 w-10 rounded-lg flex items-center justify-center transition-all duration-300 shadow-sm flex-shrink-0 ${theme === 'dark' ? 'bg-slate-800 text-indigo-400 ring-1 ring-white/10' : 'bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100'}`}>
              {plugin.iconUrl && !hasImageError ? (
                <img
                  src={plugin.iconUrl}
                  alt={plugin.name}
                  className="w-6 h-6 object-contain"
                  onError={onImageError}
                />
              ) : (
                <FrameworkIcons.Box size={22} strokeWidth={1.5} />
              )}
            </div>
            <div className="flex items-center gap-2">
              {isFeatured && (
                <Badge variant="blue" className="bg-indigo-500/10 text-indigo-500 border-indigo-500/20">
                  Featured
                </Badge>
              )}
              <Badge variant={installed ? "success" : "blue"} className="flex-shrink-0 font-semibold">
                {installed ? "Installed" : (plugin.category || "Available")}
              </Badge>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <h3 className={`text-base font-bold tracking-tight leading-tight transition-colors duration-300 group-hover:text-indigo-500 line-clamp-1 flex-1 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                {plugin.name}
              </h3>
              {isVerified && (
                <div className="bg-emerald-500/10 p-1 rounded-full text-emerald-500" title="Verified Publisher">
                  <FrameworkIcons.Shield size={14} fill="currentColor" className="opacity-80" />
                </div>
              )}
            </div>
            <p className={`text-xs leading-snug font-medium line-clamp-2 transition-colors duration-300 ${theme === 'dark' ? 'text-slate-400 group-hover:text-slate-300' : 'text-slate-500 group-hover:text-slate-600'}`}>
              {plugin.description}
            </p>
          </div>

          <div className={`flex flex-wrap items-center gap-2.5 text-[10px] font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
            {installed ? (
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <FrameworkIcons.Check size={12} className="text-emerald-500/80" />
                Installed {installedVersion}
              </div>
            ) : (
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <FrameworkIcons.Shield size={12} className="text-indigo-500/70" />
                Available
              </div>
            )}
            <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <FrameworkIcons.Shield size={12} className="text-indigo-500/70" />
              Marketplace {plugin.version}
            </div>
            <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
            <div className="flex items-center gap-1.5 min-w-0">
              <FrameworkIcons.User size={12} className="text-indigo-500/70" />
              <span className="truncate flex items-center gap-1">
                {plugin.author || 'Official Developer'}
                {isVerified && (
                  <FrameworkIcons.Check size={10} className="text-emerald-500" strokeWidth={3} />
                )}
              </span>
            </div>
            {isTrending && (
              <>
                <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                <div className="flex items-center gap-1.5 text-rose-500">
                  <FrameworkIcons.Loader size={10} className="animate-spin" />
                  Trending
                </div>
              </>
            )}
          </div>
        </div>

        <MarketplaceCardActions
          plugin={plugin}
          theme={theme}
          installed={installed}
          installedVersion={installedVersion}
          hasUpdate={hasUpdate}
          installing={installing}
          onOpenInstalled={onOpenInstalled}
          onInstall={onInstall}
        />
      </Card>
    );
  }
}

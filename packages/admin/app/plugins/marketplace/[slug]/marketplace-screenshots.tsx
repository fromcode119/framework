"use client";

import React from 'react';
import { FrameworkIcons } from '@fromcode119/react';
import type { MarketplaceScreenshotsProps } from './marketplace-detail-sections.interfaces';

export class MarketplaceScreenshots extends React.Component<MarketplaceScreenshotsProps> {
  render(): React.ReactNode {
    const {
      plugin,
      theme,
      activeImageIndex,
      onOpenLightbox,
      onSelectImage,
    } = this.props;
    if (!plugin.screenshots || plugin.screenshots.length === 0) return null;

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className={`text-[11px] font-bold uppercase tracking-widest flex items-center gap-3 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
            <FrameworkIcons.Image size={14} className="text-indigo-500" />
            Product Screenshots
          </h3>
          <span className={`text-[10px] font-semibold uppercase tracking-wide px-3 py-1 rounded-lg ${theme === 'dark' ? 'bg-slate-800 text-slate-500' : 'bg-slate-100 text-slate-400'}`}>
            {plugin.screenshots.length} Images
          </span>
        </div>

        <div className="space-y-4">
          <div
            onClick={onOpenLightbox}
            className={`aspect-video rounded-xl overflow-hidden border-2 relative group cursor-zoom-in transition-all duration-500 ${
              theme === 'dark' ? 'bg-slate-900 border-white/5' : 'bg-slate-50 border-white shadow-sm'
            }`}
          >
              <img
                src={typeof plugin.screenshots[activeImageIndex] === 'string' ? (plugin.screenshots[activeImageIndex] as string) : (plugin.screenshots[activeImageIndex] as any).url}
                alt="Main Screenshot"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-500 flex items-center justify-center">
                  <div className="h-14 w-14 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center opacity-0 group-hover:opacity-100 translate-y-4 group-hover:translate-y-0 transition-all duration-300 text-white">
                     <FrameworkIcons.Search size={24} strokeWidth={2.5} />
                  </div>
              </div>
          </div>

          {plugin.screenshots.length > 1 && (
            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
              {plugin.screenshots.map((item, idx) => {
                const src = typeof item === 'string' ? item : item.url;
                return (
                  <button
                    key={idx}
                    onClick={() => onSelectImage(idx)}
                    className={`relative h-24 min-w-[160px] rounded-2xl overflow-hidden border-2 transition-all duration-300 active:scale-95 ${
                      activeImageIndex === idx
                        ? 'border-indigo-500 ring-4 ring-indigo-500/20 z-10 scale-105'
                        : (theme === 'dark' ? 'border-white/5 opacity-50 hover:opacity-100' : 'border-white shadow-lg shadow-slate-200/50 opacity-60 hover:opacity-100')
                    }`}
                  >
                    <img
                      src={src}
                      alt={`Thumbnail ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                     {activeImageIndex === idx && (
                        <div className="absolute inset-0 bg-indigo-500/10 flex items-center justify-center">
                           <div className="h-6 w-6 rounded-full bg-indigo-500 text-white flex items-center justify-center">
                              <FrameworkIcons.Check size={12} strokeWidth={4} />
                           </div>
                        </div>
                     )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }
}

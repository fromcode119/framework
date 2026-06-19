"use client";

import React from 'react';
import { FrameworkIcons } from '@fromcode119/react';
import type { ThemeMarketplaceGalleryProps } from './theme-marketplace-sections.interfaces';

export class ThemeMarketplaceGallery extends React.Component<ThemeMarketplaceGalleryProps> {
  render(): React.ReactNode {
    const { theme, adminTheme, screenshots, activeImageIndex, onOpenLightbox, onSelectImage } = this.props;
    if (screenshots.length === 0) {
      return (
        <div className={`aspect-video rounded-[2.5rem] flex items-center justify-center border-2 border-dashed ${adminTheme === 'dark' ? 'bg-slate-900/40 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
          <FrameworkIcons.Image size={64} className="opacity-20" />
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className={`text-[11px] font-bold uppercase tracking-widest flex items-center gap-3 ${adminTheme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
          </h3>
        </div>

        <div className="space-y-4">
          <div
            onClick={onOpenLightbox}
            className={`aspect-video rounded-[2.5rem] overflow-hidden border-2 relative group cursor-zoom-in transition-all duration-500 ${
              adminTheme === 'dark' ? 'bg-slate-900 border-white/5' : 'bg-slate-50 border-white shadow-[0_30px_60px_-20px_rgba(0,0,0,0.1)]'
            }`}
          >
            <img
              src={screenshots[activeImageIndex]}
              alt={theme.name}
              className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-500 flex items-center justify-center">
              <div className="h-14 w-14 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center opacity-0 group-hover:opacity-100 translate-y-4 group-hover:translate-y-0 transition-all duration-300 text-white">
                <FrameworkIcons.Search size={24} strokeWidth={2.5} />
              </div>
            </div>
          </div>

          {screenshots.length > 1 && (
            <div className="px-4 -mx-4 pt-8 pb-8 overflow-x-auto scrollbar-hide">
              <div className="flex gap-6 w-fit min-w-full">
                {screenshots.map((s, idx) => (
                  <button
                    key={idx}
                    onClick={() => onSelectImage(idx)}
                    className={`relative h-24 min-w-[170px] rounded-2xl overflow-hidden border-2 transition-all duration-300 active:scale-95 ${
                      activeImageIndex === idx
                        ? 'border-indigo-500 ring-4 ring-indigo-500/20 z-10 scale-105 shadow-2xl shadow-indigo-500/20'
                        : (adminTheme === 'dark' ? 'border-white/5 opacity-50 hover:opacity-100' : 'border-white shadow-lg shadow-slate-200/50 opacity-60 hover:opacity-100')
                    }`}
                  >
                    <img src={s} className="w-full h-full object-cover" alt="" />
                    {activeImageIndex === idx && (
                      <div className="absolute inset-0 bg-indigo-500/10 flex items-center justify-center">
                        <div className="h-6 w-6 rounded-full bg-indigo-500 text-white flex items-center justify-center">
                          <FrameworkIcons.Check size={12} strokeWidth={4} />
                        </div>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
}

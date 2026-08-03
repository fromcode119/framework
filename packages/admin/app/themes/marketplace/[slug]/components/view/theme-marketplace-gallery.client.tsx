import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/reactor';
import { FrameworkIcons } from '@fromcode119/react';
import type { IMarketplaceTheme } from '@fromcode119/core/client';
import { AdminClass } from '@/lib/admin-class';

export class ThemeMarketplaceGallery extends PureReactor {
  /** JSX props — the declared @prop fields, so call sites are type-checked without a <Props> generic. */
  declare props: Pick<ThemeMarketplaceGallery, 'theme' | 'adminTheme' | 'screenshots' | 'activeImageIndex' | 'onOpenLightbox' | 'onSelectImage'>;

  @prop declare theme: IMarketplaceTheme;
  @prop declare adminTheme: ThemeMode;
  @prop declare screenshots: string[];
  @prop declare activeImageIndex: number;
  @prop declare onOpenLightbox: () => void;
  @prop declare onSelectImage: (idx: number) => void;

  render(): ReactNode {
    const { theme, adminTheme, screenshots, activeImageIndex, onOpenLightbox, onSelectImage } = this;
    if (screenshots.length === 0) {
      return (
        <div className={`aspect-video ${AdminClass.SURFACE} flex items-center justify-center border-2 border-dashed ${adminTheme === ThemeMode.DARK ? 'bg-slate-900/40 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
          <FrameworkIcons.Image size={48} className="opacity-20" />
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="space-y-3">
          <div
            onClick={onOpenLightbox}
            className={`aspect-video rounded-xl overflow-hidden border-2 relative group cursor-zoom-in transition-all duration-300 ${
              adminTheme === ThemeMode.DARK ? 'bg-slate-900 border-white/5' : 'bg-slate-50 border-white shadow-sm'
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
            <div className="px-4 -mx-4 pt-3 pb-3 overflow-x-auto scrollbar-hide">
              <div className="flex gap-4 w-fit min-w-full">
                {screenshots.map((s, idx) => (
                  <button
                    key={idx}
                    onClick={() => onSelectImage(idx)}
                    className={`relative h-20 min-w-[150px] rounded-lg overflow-hidden border-2 transition-all duration-300 active:scale-95 ${
                      activeImageIndex === idx
                        ? 'border-indigo-500 ring-2 ring-indigo-500/20 z-10 shadow-sm'
                        : (adminTheme === ThemeMode.DARK ? 'border-white/5 opacity-50 hover:opacity-100' : 'border-white shadow-sm opacity-60 hover:opacity-100')
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

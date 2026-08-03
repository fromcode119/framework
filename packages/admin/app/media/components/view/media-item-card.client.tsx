import { MovingItemType } from '@/app/media/enums/moving-item-type.enum';
import { BadgeVariant } from '@/components/ui/enums/badge-variant.enum';
import { ThemeMode } from '@fromcode119/core/client';
import { ViewMode } from '@/app/media/enums/view-mode.enum';
import type React from 'react';
import { PureReactor, prop, bound } from '@fromcode119/reactor';
import { Card } from '@/components/ui/view/card.client';
import { Badge } from '@/components/ui/view/badge.client';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminServices } from '@/lib/admin-services';
import type { IMediaItem } from '@/app/media/interfaces/media-item.interface';
import type { IMovingItem } from '@/app/media/interfaces/moving-item.interface';
import { AdminClass } from '@/lib/admin-class';

export class MediaItemCard extends PureReactor {
  @prop declare theme: ThemeMode;
  @prop declare item: IMediaItem;
  @prop declare viewMode: ViewMode;
  @prop declare optimizingId: number | null;
  @prop declare setMovingItem: (item: IMovingItem | null) => void;
  @prop declare setIsMoveDialogOpen: (value: boolean) => void;
  @prop declare setDeletingId: (id: number | null) => void;
  @prop declare setIsDeleteDialogOpen: (value: boolean) => void;
  @prop declare setEditingItem: (item: IMediaItem | null) => void;
  @prop declare handleOptimize: (item: IMediaItem) => Promise<void>;

  private get mediaUrl(): string {
    return AdminServices.getInstance().media.resolveMediaUrl(this.item.url);
  }

  private formatSize(bytes: number): string {
    return AdminServices.getInstance().formatter.formatSize(bytes);
  }

  @bound
  onOptimize(): void {
    void this.handleOptimize(this.item);
  }

  @bound
  onEdit(): void {
    this.setEditingItem(this.item);
  }

  @bound
  onMove(): void {
    this.setMovingItem({ id: this.item.id, type: MovingItemType.FILE });
    this.setIsMoveDialogOpen(true);
  }

  @bound
  onDelete(): void {
    this.setDeletingId(this.item.id);
    this.setIsDeleteDialogOpen(true);
  }

  render(): React.ReactNode {
    const { theme, item, viewMode, optimizingId } = this;
    const mediaUrl = this.mediaUrl;

    return viewMode === ViewMode.GRID ? (
      <Card key={item.id} className={`p-0 overflow-hidden group ${AdminClass.SURFACE}`}>
        <div className={`aspect-square relative flex items-center justify-center ${theme === ThemeMode.DARK ? 'bg-slate-800/50' : 'bg-slate-700/5'}`}>
          {item.mimeType.startsWith('image/') ? (
            <img
              src={mediaUrl}
              alt={item.originalName}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <FrameworkIcons.File size={48} className="text-slate-300 group-hover:scale-110 transition-transform duration-500" />
          )}

          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <a
                href={mediaUrl}
                download
                className="p-2 bg-white rounded-lg text-slate-900 hover:bg-slate-100 transition-colors"
                target="_blank"
                rel="noopener noreferrer"
              >
                <FrameworkIcons.Download size={18} />
              </a>
              {['image/jpeg', 'image/jpg', 'image/png'].includes(item.mimeType) && (
                <button
                  onClick={this.onOptimize}
                  disabled={optimizingId === item.id}
                  title={item.optimizedUrl ? `Optimized · ${this.formatSize(item.optimizedSize ?? 0)}` : 'Convert to WebP'}
                  className="p-2 bg-white rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-60"
                >
                  {optimizingId === item.id ? <FrameworkIcons.Loader size={18} className="animate-spin" /> : <FrameworkIcons.Zap size={18} />}
                </button>
              )}
              <button
                onClick={this.onEdit}
                title="Edit details (alt text, caption)"
                className="p-2 bg-white rounded-lg text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <FrameworkIcons.Edit size={18} />
              </button>
              <button
                onClick={this.onMove}
                className="p-2 bg-white rounded-lg text-indigo-600 hover:bg-indigo-50 transition-colors"
              >
                <FrameworkIcons.External size={18} />
              </button>
              <button
                onClick={this.onDelete}
                className="p-2 bg-white rounded-lg text-red-600 hover:bg-red-50 transition-colors"
              >
                <FrameworkIcons.Trash size={18} />
              </button>
          </div>
        </div>
        <div className="p-4">
          <div className={`font-semibold text-sm truncate ${theme === ThemeMode.DARK ? 'text-slate-200' : 'text-slate-900'}`} title={item.originalName}>
            {item.originalName}
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-[10px] text-slate-500 font-medium tracking-wide">{this.formatSize(item.fileSize)}</span>
            <div className="flex items-center gap-1">
              {item.optimizedUrl && (
                <Badge variant={BadgeVariant.SUCCESS} className="text-[10px]">WebP</Badge>
              )}
              <Badge variant={BadgeVariant.GRAY} className="text-[10px]">
                {item.mimeType.split('/')[1]?.toUpperCase() || 'FILE'}
              </Badge>
            </div>
          </div>
        </div>
      </Card>
    ) : (
      <Card key={item.id} className={`p-3 flex items-center gap-4 group ${AdminClass.SURFACE}`}>
         <div className={`h-10 w-10 rounded-lg flex items-center justify-center overflow-hidden ${theme === ThemeMode.DARK ? 'bg-slate-800' : 'bg-slate-100'}`}>
            {item.mimeType.startsWith('image/') ? (
              <img src={mediaUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <FrameworkIcons.File size={20} className="text-slate-400" />
            )}
         </div>
         <div className="flex-1 min-w-0">
            <div className={`font-semibold text-sm truncate ${theme === ThemeMode.DARK ? 'text-white' : 'text-slate-900'}`}>{item.originalName}</div>
            <div className="text-[10px] text-slate-500 font-medium">
              {this.formatSize(item.fileSize)} • {item.mimeType}
              {item.optimizedUrl && item.optimizedSize && (
                <span className="ml-2 text-emerald-500">→ WebP {this.formatSize(item.optimizedSize)}</span>
              )}
            </div>
         </div>
         <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <a href={mediaUrl} download className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-slate-500"><FrameworkIcons.Download size={16} /></a>
            {['image/jpeg', 'image/jpg', 'image/png'].includes(item.mimeType) && (
              <button
                onClick={this.onOptimize}
                disabled={optimizingId === item.id}
                title={item.optimizedUrl ? 'Re-optimize to WebP' : 'Convert to WebP'}
                className="p-2 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg text-emerald-500 disabled:opacity-60"
              >
                {optimizingId === item.id ? <FrameworkIcons.Loader size={16} className="animate-spin" /> : <FrameworkIcons.Zap size={16} />}
              </button>
            )}
            <button
              onClick={this.onEdit}
              title="Edit details (alt text, caption)"
              className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-slate-500"
            >
              <FrameworkIcons.Edit size={16} />
            </button>
            <button
              onClick={this.onMove}
              className="p-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg text-indigo-500"
            >
              <FrameworkIcons.External size={16} />
            </button>
            <button
              onClick={this.onDelete}
              className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-red-500"
            >
              <FrameworkIcons.Trash size={16} />
            </button>
         </div>
      </Card>
    );
  }
}

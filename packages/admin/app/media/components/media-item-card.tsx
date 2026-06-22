"use client";

import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminServices } from '@/lib/admin-services';
import type { MediaItemCardProps } from '../media-page.interfaces';

const { File, Download, Trash, Loader, External, Zap } = FrameworkIcons;

export default class MediaItemCard extends React.Component<MediaItemCardProps> {
  render(): React.ReactNode {
    const {
      theme,
      item,
      viewMode,
      optimizingId,
      setMovingItem,
      setIsMoveDialogOpen,
      setDeletingId,
      setIsDeleteDialogOpen,
      handleOptimize,
    } = this.props;

    const mediaUrl = AdminServices.getInstance().media.resolveMediaUrl(item.url);

    return viewMode === 'grid' ? (
      <Card key={item.id} className="p-0 overflow-hidden group rounded-3xl bg-white dark:bg-slate-900/50 border-none shadow-xl shadow-slate-200/50 dark:shadow-none">
        <div className={`aspect-square relative flex items-center justify-center ${theme === 'dark' ? 'bg-slate-800/50' : 'bg-slate-700/5'}`}>
          {item.mimeType.startsWith('image/') ? (
            <img
              src={mediaUrl}
              alt={item.originalName}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <File size={48} className="text-slate-300 group-hover:scale-110 transition-transform duration-500" />
          )}

          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <a
                href={mediaUrl}
                download
                className="p-2 bg-white rounded-lg text-slate-900 hover:bg-slate-100 transition-colors"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Download size={18} />
              </a>
              {['image/jpeg', 'image/jpg', 'image/png'].includes(item.mimeType) && (
                <button
                  onClick={() => handleOptimize(item)}
                  disabled={optimizingId === item.id}
                  title={item.optimizedUrl ? `Optimized · ${AdminServices.getInstance().formatter.formatSize(item.optimizedSize ?? 0)}` : 'Convert to WebP'}
                  className="p-2 bg-white rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-60"
                >
                  {optimizingId === item.id ? <Loader size={18} className="animate-spin" /> : <Zap size={18} />}
                </button>
              )}
              <button
                onClick={() => {
                  setMovingItem({ id: item.id, type: 'file' });
                  setIsMoveDialogOpen(true);
                }}
                className="p-2 bg-white rounded-lg text-indigo-600 hover:bg-indigo-50 transition-colors"
              >
                <External size={18} />
              </button>
              <button
                onClick={() => {
                  setDeletingId(item.id);
                  setIsDeleteDialogOpen(true);
                }}
                className="p-2 bg-white rounded-lg text-red-600 hover:bg-red-50 transition-colors"
              >
                <Trash size={18} />
              </button>
          </div>
        </div>
        <div className="p-4">
          <div className={`font-semibold text-sm truncate ${theme === 'dark' ? 'text-slate-200' : 'text-slate-900'}`} title={item.originalName}>
            {item.originalName}
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-[10px] text-slate-500 font-medium tracking-wide">{AdminServices.getInstance().formatter.formatSize(item.fileSize)}</span>
            <div className="flex items-center gap-1">
              {item.optimizedUrl && (
                <Badge variant="success" className="text-[10px]">WebP</Badge>
              )}
              <Badge variant="gray" className="text-[10px]">
                {item.mimeType.split('/')[1]?.toUpperCase() || 'FILE'}
              </Badge>
            </div>
          </div>
        </div>
      </Card>
    ) : (
      <Card key={item.id} className="p-3 flex items-center gap-4 group rounded-xl bg-white dark:bg-slate-900/50 border-none shadow-sm">
         <div className={`h-10 w-10 rounded-lg flex items-center justify-center overflow-hidden ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-100'}`}>
            {item.mimeType.startsWith('image/') ? (
              <img src={mediaUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <File size={20} className="text-slate-400" />
            )}
         </div>
         <div className="flex-1 min-w-0">
            <div className={`font-semibold text-sm truncate ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{item.originalName}</div>
            <div className="text-[10px] text-slate-500 font-medium">
              {AdminServices.getInstance().formatter.formatSize(item.fileSize)} • {item.mimeType}
              {item.optimizedUrl && item.optimizedSize && (
                <span className="ml-2 text-emerald-500">→ WebP {AdminServices.getInstance().formatter.formatSize(item.optimizedSize)}</span>
              )}
            </div>
         </div>
         <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <a href={mediaUrl} download className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-slate-500"><Download size={16} /></a>
            {['image/jpeg', 'image/jpg', 'image/png'].includes(item.mimeType) && (
              <button
                onClick={() => handleOptimize(item)}
                disabled={optimizingId === item.id}
                title={item.optimizedUrl ? 'Re-optimize to WebP' : 'Convert to WebP'}
                className="p-2 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg text-emerald-500 disabled:opacity-60"
              >
                {optimizingId === item.id ? <Loader size={16} className="animate-spin" /> : <Zap size={16} />}
              </button>
            )}
            <button
              onClick={() => {
                setMovingItem({ id: item.id, type: 'file' });
                setIsMoveDialogOpen(true);
              }}
              className="p-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg text-indigo-500"
            >
              <External size={16} />
            </button>
            <button
              onClick={() => {
                setDeletingId(item.id);
                setIsDeleteDialogOpen(true);
              }}
              className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-red-500"
            >
              <Trash size={16} />
            </button>
         </div>
      </Card>
    );
  }
}

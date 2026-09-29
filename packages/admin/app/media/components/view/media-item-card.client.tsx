import { BadgeVariant } from '@/components/ui/enums/badge-variant.enum';
import { ThemeMode } from '@fromcode119/core/client';
import { ViewMode } from '@/app/media/enums/view-mode.enum';
import type React from 'react';
import { Card } from '@/components/ui/view/card.client';
import { Badge } from '@/components/ui/view/badge.client';
import { Checkbox } from '@/components/ui/view/checkbox.client';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminClass } from '@/lib/admin-class';
import { MediaItemCardState } from '@/app/media/components/view/media-item-card-state.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * One file in the media library, as a grid tile or a list row.
 *
 * The top of the chain: the markup. What the card knows and what it can do live in
 * `MediaItemCardState`.
 */
export class MediaItemCard extends MediaItemCardState {
  render(): React.ReactNode {
    const { theme, item, viewMode, optimizingId } = this;
    const mediaUrl = this.mediaUrl;

    return viewMode === ViewMode.GRID ? (
      <Card key={item.id} noPadding className={`overflow-hidden group ${AdminClass.SURFACE}`}>
        <div className={`aspect-square relative overflow-hidden flex items-center justify-center ${theme === ThemeMode.DARK ? 'bg-slate-800/50' : 'bg-slate-700/5'}`}>
        {/* The tile itself is the primary action, because a picture is what the operator clicks. Both
            kinds open details — an upload its editable record, a theme asset its facts — so the click
            answers the same question either way. Positioned BEHIND the tick and the action bar (z-0
            against their z-10) rather than wrapping them: a button inside a button is invalid markup
            and double-fires, which is the very thing this component was rewritten to avoid. */}
        <button
          type="button"
          onClick={this.onEdit}
          aria-label={AdminI18n.t('media.openDetailsFor', { originalName: item.originalName })}
          title={AdminI18n.t('media.openDetails')}
          className="absolute inset-0 z-0 cursor-pointer"
        />

        {/* Selection tick — the same square the data table uses. Checkbox IS a button, so it is
            positioned directly rather than wrapped in one: nesting buttons is invalid markup and
            reintroduces the double-activation this component was rewritten to avoid. */}
        {this.isReadOnly ? null : (
          <Checkbox
            checked={this.selected}
            onChange={this.onToggleSelected}
            className={`absolute top-2 left-2 z-10 transition-opacity ${this.selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
          />
        )}

          {item.mimeType.startsWith('image/') && !this.imageFailed ? (
            <img
              src={this.previewUrl}
              alt={item.originalName}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              onError={this.onImageError}
            />
          ) : (
            <FrameworkIcons.File size={48} className="text-slate-300 group-hover:scale-110 transition-transform duration-500" />
          )}
          {/* The badge, not a placeholder: the artwork is visible AND the file is marked protected. */}
          {this.isPrivate ? (
            <span className="absolute top-2 right-2 z-10 inline-flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-widest text-white">
              <FrameworkIcons.Lock size={10} /> {AdminI18n.t('media.private')}
            </span>
          ) : null}

          {/* Why this tile has no Edit/Move/Delete (a theme asset), and whether a WebP copy exists.
              Without the Theme mark the operator sees controls missing from some tiles and not others
              with nothing on screen accounting for the difference. */}
          {this.isReadOnly || item.optimizedUrl ? (
            <span className="absolute bottom-2 left-2 z-10 flex gap-1">
              {this.isReadOnly ? (
                <span className="rounded-md bg-white/90 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 shadow-sm dark:bg-slate-900/90 dark:text-slate-200">{AdminI18n.t('media.theme')}</span>
              ) : null}
              {item.optimizedUrl ? (
                <span className="rounded-md bg-emerald-500/90 px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-sm">WebP</span>
              ) : null}
            </span>
          ) : null}

          {/* The card's own overlay: the tile dims and its actions sit in the MIDDLE as white pills.
              `pointer-events-none` on the container so the dim never swallows a click on the tile
              itself (which opens details); each control re-enables them for its own hit area. */}
          <div className="absolute inset-0 z-10 bg-slate-950/45 opacity-0 group-hover:opacity-100 transition-opacity flex flex-wrap content-center items-center justify-center gap-1.5 p-3 pointer-events-none">
              {/* Withheld for a private file: the public URL does not exist, so this would 404. */}
              {this.isPrivate ? null : (
                <a
                  href={mediaUrl}
                  download
                  title={AdminI18n.t('media.download')}
                  className="pointer-events-auto p-1.5 bg-white rounded-lg shadow-sm text-slate-900 hover:bg-slate-100 transition-colors"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <FrameworkIcons.Download size={16} />
                </a>
              )}
              {this.isReadOnly
                ? this.renderLockedAction(<FrameworkIcons.Zap size={16} />, 'text-emerald-600', AdminI18n.t('media.shipsWithTheThemeThere'))
                : ['image/jpeg', 'image/jpg', 'image/png'].includes(item.mimeType) && (
                  <button
                    onClick={this.onOptimize}
                    disabled={optimizingId === item.id}
                    title={item.optimizedUrl ? AdminI18n.t('media.optimized', { formatSize: this.formatSize(item.optimizedSize ?? 0) }) : AdminI18n.t('media.convertToWebp')}
                    className="pointer-events-auto cursor-pointer p-1.5 bg-white rounded-lg shadow-sm text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-60"
                  >
                    {optimizingId === item.id ? <FrameworkIcons.Loader size={16} className="animate-spin" /> : <FrameworkIcons.Zap size={16} />}
                  </button>
                )}
              {/* A theme asset has no record to edit, so this slot holds Details — the file's own facts. */}
              {this.isReadOnly ? (
                <button
                  onClick={this.onEdit}
                  title={AdminI18n.t('media.details')}
                  className="pointer-events-auto cursor-pointer p-1.5 bg-white rounded-lg shadow-sm text-slate-900 hover:bg-slate-100 transition-colors"
                >
                  <FrameworkIcons.Info size={16} />
                </button>
              ) : (
                <button
                  onClick={this.onEdit}
                  title={AdminI18n.t('media.editDetailsAltTextCaption')}
                  className="pointer-events-auto cursor-pointer p-1.5 bg-white rounded-lg shadow-sm text-slate-900 hover:bg-slate-100 transition-colors"
                >
                  <FrameworkIcons.Edit size={16} />
                </button>
              )}
              {this.isReadOnly
                ? this.renderLockedAction(<FrameworkIcons.External size={16} />, 'text-indigo-600', AdminI18n.t('media.shipsWithTheThemeIt'))
                : (
                  <button
                    onClick={this.onMove}
                    title={AdminI18n.t('media.moveToFolder')}
                    className="pointer-events-auto cursor-pointer p-1.5 bg-white rounded-lg shadow-sm text-indigo-600 hover:bg-indigo-50 transition-colors"
                  >
                    <FrameworkIcons.External size={16} />
                  </button>
                )}
              {this.isReadOnly
                ? this.renderLockedAction(<FrameworkIcons.Trash size={16} />, 'text-red-600', AdminI18n.t('media.shipsWithTheThemeRemove'))
                : (
                  <button
                    onClick={this.onDelete}
                    title={AdminI18n.t('media.delete')}
                    className="pointer-events-auto cursor-pointer p-1.5 bg-white rounded-lg shadow-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <FrameworkIcons.Trash size={16} />
                  </button>
                )}
          </div>
        </div>
        {/* Name, then one quiet line of facts. The type and size used to be pills beside the status
            badges, which could not fit a tile this narrow: the size wrapped under its unit and the
            type pill was cut in half. Status (theme asset, WebP copy) now reads off the image. */}
        <div className="px-3 py-2.5">
          <div className={`text-[13px] font-medium leading-snug truncate ${theme === ThemeMode.DARK ? 'text-slate-200' : 'text-slate-900'}`} title={item.originalName}>
            {item.originalName}
          </div>
          <div className="mt-0.5 truncate text-[11px] tabular-nums text-slate-500">
            {[this.sizeLabel, item.mimeType.split('/')[1]?.toUpperCase() || 'FILE'].filter(Boolean).join(' · ')}
          </div>
        </div>
      </Card>
    ) : (
      <Card key={item.id} className={`px-3 py-2 flex items-center gap-3 group ${AdminClass.SURFACE}`}>
         {/* List view had NO selection tick, so multi-select — the thing sharing depends on — simply
             did not exist here. Same component as the grid, so ticking behaves identically in both,
             and withheld on a theme asset for the same reason: selection feeds move/delete/share, and
             none of those exist for a file that lives in the theme bundle. */}
         {this.isReadOnly ? null : <Checkbox checked={this.selected} onChange={this.onToggleSelected} />}
         <div className={`h-8 w-8 rounded-md flex items-center justify-center overflow-hidden flex-shrink-0 ${theme === ThemeMode.DARK ? 'bg-slate-800' : 'bg-slate-100'}`}>
            {item.mimeType.startsWith('image/') && !this.imageFailed ? (
              <img src={this.previewUrl} alt="" className="w-full h-full object-cover" onError={this.onImageError} />
            ) : (
              <FrameworkIcons.File size={20} className="text-slate-400" />
            )}
         </div>
         {/* Fixed-width columns rather than one free-flowing line, so size, type and visibility sit
             under each other down the list and can be compared by scanning instead of by reading. */}
         <div className="flex-1 min-w-0">
            {/* The name is the row's primary action, matching the grid tile: one click, same details. */}
            <button
              type="button"
              onClick={this.onEdit}
              title={AdminI18n.t('media.openDetails')}
              className={`block w-full cursor-pointer truncate text-left font-semibold text-sm hover:underline ${theme === ThemeMode.DARK ? 'text-white' : 'text-slate-900'}`}
            >
              {item.originalName}
            </button>
         </div>
         <div className="hidden md:block w-20 text-right text-[11px] text-slate-500 font-medium tabular-nums flex-shrink-0">
            {this.sizeLabel}
         </div>
         <div className="hidden lg:block w-24 text-[11px] text-slate-500 font-medium truncate flex-shrink-0">
            {item.mimeType.split('/')[1]?.toUpperCase() || 'FILE'}
         </div>
         <div className="hidden lg:flex w-24 items-center gap-1 flex-shrink-0">
            {this.isReadOnly ? <Badge variant={BadgeVariant.GRAY} className="text-[10px]">{AdminI18n.t('media.theme')}</Badge> : null}
            {String(item.visibility || 'public') === 'private' ? (
              <Badge variant={BadgeVariant.WARNING} className="text-[10px]">{AdminI18n.t('media.private')}</Badge>
            ) : null}
            {item.optimizedUrl ? <Badge variant={BadgeVariant.SUCCESS} className="text-[10px]">WebP</Badge> : null}
         </div>
         <div className="flex items-center gap-0.5 flex-shrink-0">
            {/* The row's counterpart to the grid bar's Details — see the note there. */}
            {this.isReadOnly ? (
              <button
                onClick={this.onEdit}
                title={AdminI18n.t('media.details')}
                className="cursor-pointer rounded-lg p-2 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <FrameworkIcons.Info size={16} />
              </button>
            ) : null}
            {this.isPrivate ? null : (
              <a href={mediaUrl} download className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-slate-500"><FrameworkIcons.Download size={16} /></a>
            )}
            {/* Same three as the grid overlay, dimmed and inert for a theme asset and for the same
                reason — see `renderLockedAction`. The row keeps its full set of controls either way. */}
            {this.isReadOnly ? (
              <>
                {this.renderLockedAction(<FrameworkIcons.Zap size={16} />, 'text-emerald-500', AdminI18n.t('media.shipsWithTheThemeThere'), 'bg-transparent')}
                {this.renderLockedAction(<FrameworkIcons.External size={16} />, 'text-indigo-500', AdminI18n.t('media.shipsWithTheThemeIt'), 'bg-transparent')}
                {this.renderLockedAction(<FrameworkIcons.Trash size={16} />, 'text-red-500', AdminI18n.t('media.shipsWithTheThemeRemove'), 'bg-transparent')}
              </>
            ) : (
              <>
                {['image/jpeg', 'image/jpg', 'image/png'].includes(item.mimeType) && (
                  <button
                    onClick={this.onOptimize}
                    disabled={optimizingId === item.id}
                    title={item.optimizedUrl ? AdminI18n.t('media.reOptimizeToWebp') : AdminI18n.t('media.convertToWebp')}
                    className="p-2 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg text-emerald-500 disabled:opacity-60"
                  >
                    {optimizingId === item.id ? <FrameworkIcons.Loader size={16} className="animate-spin" /> : <FrameworkIcons.Zap size={16} />}
                  </button>
                )}
                <button
                  onClick={this.onEdit}
                  title={AdminI18n.t('media.editDetailsAltTextCaption')}
                  className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-slate-500"
                >
                  <FrameworkIcons.Edit size={16} />
                </button>
                <button
                  onClick={this.onMove}
                  title={AdminI18n.t('media.moveToFolder')}
                  className="p-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg text-indigo-500"
                >
                  <FrameworkIcons.External size={16} />
                </button>
                <button
                  onClick={this.onDelete}
                  title={AdminI18n.t('media.delete')}
                  className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-red-500"
                >
                  <FrameworkIcons.Trash size={16} />
                </button>
              </>
            )}
         </div>
      </Card>
    );
  }
}

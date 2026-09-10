import { MovingItemType } from '@/app/media/enums/moving-item-type.enum';
import { BadgeVariant } from '@/components/ui/enums/badge-variant.enum';
import { ThemeMode } from '@fromcode119/core/client';
import { ViewMode } from '@/app/media/enums/view-mode.enum';
import type React from 'react';
import { PureReactor, prop, state, bound } from '@fromcode119/react-class-components';
import { Card } from '@/components/ui/view/card.client';
import { Badge } from '@/components/ui/view/badge.client';
import { Checkbox } from '@/components/ui/view/checkbox.client';
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
  @prop declare selected: boolean;

  /**
   * A theme asset lives inside the theme bundle: there is nothing to delete, move, optimize, make
   * private or share. It is listed so the operator can SEE and reference it, and every write control
   * is withheld rather than shown and then failing.
   */
  private get isReadOnly(): boolean {
    return Boolean(this.item.readOnly);
  }

  /**
   * The uploaded record's numeric id.
   *
   * Only ever read on write paths — select, move, delete, optimize — and every one of those is
   * withheld for a read-only theme asset, whose id is a `theme:<path>` string. So by the time this is
   * called the id IS numeric.
   */
  private get uploadId(): number {
    return Number(this.item.id);
  }
  @prop declare toggleSelected: (id: number) => void;
  @prop declare handleOptimize: (item: IMediaItem) => Promise<void>;

  /**
   * A private file has NO public URL — that is the entire point of it. Its DOWNLOAD and open-in-tab
   * actions therefore stay withheld here; there is no public link to give.
   *
   * Its PREVIEW is a different question, and the first version got it wrong: the card drew a lock in
   * place of the artwork, so the operator could not recognise the file they had uploaded themselves.
   * `resolvePreviewUrl` sends private files through the admin-guarded raw route instead — private means
   * not public, never hidden from the person who owns the library.
   */
  private get isPrivate(): boolean {
    return String(this.item.visibility || 'public') === 'private';
  }

  private get mediaUrl(): string {
    return AdminServices.getInstance().media.resolveMediaUrl(this.item.url);
  }

  private get previewUrl(): string {
    return AdminServices.getInstance().media.resolvePreviewUrl(this.item);
  }

  /**
   * Set when the bytes cannot be loaded, so the card shows the generic file icon instead of the
   * browser's broken-image glyph — which reads as a bug in the page rather than as a missing file.
   */
  @state private imageFailed = false;

  @bound
  onImageError(): void {
    this.imageFailed = true;
  }

  private formatSize(bytes: number): string {
    return AdminServices.getInstance().formatter.formatSize(bytes);
  }

  /** Size only when it is KNOWN: `0` here means "not reported", and "0 B" would read as a real answer. */
  private get sizeLabel(): string {
    const bytes = Number(this.item.fileSize);
    return Number.isFinite(bytes) && bytes > 0 ? this.formatSize(bytes) : '';
  }

  @bound
  onOptimize(): void {
    void this.handleOptimize(this.item);
  }

  @bound
  onToggleSelected(): void {
    this.toggleSelected(this.uploadId);
  }

  @bound
  onEdit(): void {
    this.setEditingItem(this.item);
  }

  @bound
  onMove(): void {
    this.setMovingItem({ id: this.uploadId, type: MovingItemType.FILE });
    this.setIsMoveDialogOpen(true);
  }

  @bound
  onDelete(): void {
    this.setDeletingId(this.uploadId);
    this.setIsDeleteDialogOpen(true);
  }

  /**
   * An action this file cannot have, shown rather than hidden.
   *
   * Optimize, Move and Delete all act on an uploaded RECORD, and a theme asset has none — its id is
   * `theme:<path>`, so `Number(id)` is `NaN` and each of them would call the API with it. Dropping
   * them left the card visibly short of controls next to an uploaded file's, which reads as a bug in
   * the page. So the pill keeps its place and its colour, dimmed and inert, and says WHY on hover.
   *
   * The `<span>` carries the title because a disabled button receives no mouse events at all, so a
   * title on the button itself would never show.
   */
  private renderLockedAction(icon: React.ReactNode, tone: string, reason: string, shell = 'bg-white'): React.ReactNode {
    return (
      <span className="pointer-events-auto inline-flex" title={reason}>
        <button type="button" disabled aria-disabled className={`cursor-not-allowed p-2 rounded-lg opacity-40 ${shell} ${tone}`}>
          {icon}
        </button>
      </span>
    );
  }

  render(): React.ReactNode {
    const { theme, item, viewMode, optimizingId } = this;
    const mediaUrl = this.mediaUrl;

    return viewMode === ViewMode.GRID ? (
      <Card key={item.id} className={`p-0 overflow-hidden group ${AdminClass.SURFACE}`}>
        <div className={`aspect-square relative flex items-center justify-center ${theme === ThemeMode.DARK ? 'bg-slate-800/50' : 'bg-slate-700/5'}`}>
        {/* The tile itself is the primary action, because a picture is what the operator clicks. Both
            kinds open details — an upload its editable record, a theme asset its facts — so the click
            answers the same question either way. Positioned BEHIND the tick and the action bar (z-0
            against their z-10) rather than wrapping them: a button inside a button is invalid markup
            and double-fires, which is the very thing this component was rewritten to avoid. */}
        <button
          type="button"
          onClick={this.onEdit}
          aria-label={`Open details for ${item.originalName}`}
          title="Open details"
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
              <FrameworkIcons.Lock size={10} /> Private
            </span>
          ) : null}

          {/* The card's own overlay: the tile dims and its actions sit in the MIDDLE as white pills.
              `pointer-events-none` on the container so the dim never swallows a click on the tile
              itself (which opens details); each control re-enables them for its own hit area. */}
          <div className="absolute inset-0 z-10 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 pointer-events-none">
              {/* Withheld for a private file: the public URL does not exist, so this would 404. */}
              {this.isPrivate ? null : (
                <a
                  href={mediaUrl}
                  download
                  title="Download"
                  className="pointer-events-auto p-2 bg-white rounded-lg text-slate-900 hover:bg-slate-100 transition-colors"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <FrameworkIcons.Download size={18} />
                </a>
              )}
              {this.isReadOnly
                ? this.renderLockedAction(<FrameworkIcons.Zap size={18} />, 'text-emerald-600', 'Ships with the theme — there is no media record to store an optimized copy on')
                : ['image/jpeg', 'image/jpg', 'image/png'].includes(item.mimeType) && (
                  <button
                    onClick={this.onOptimize}
                    disabled={optimizingId === item.id}
                    title={item.optimizedUrl ? `Optimized · ${this.formatSize(item.optimizedSize ?? 0)}` : 'Convert to WebP'}
                    className="pointer-events-auto cursor-pointer p-2 bg-white rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-60"
                  >
                    {optimizingId === item.id ? <FrameworkIcons.Loader size={18} className="animate-spin" /> : <FrameworkIcons.Zap size={18} />}
                  </button>
                )}
              {/* A theme asset has no record to edit, so this slot holds Details — the file's own facts. */}
              {this.isReadOnly ? (
                <button
                  onClick={this.onEdit}
                  title="Details"
                  className="pointer-events-auto cursor-pointer p-2 bg-white rounded-lg text-slate-900 hover:bg-slate-100 transition-colors"
                >
                  <FrameworkIcons.Info size={18} />
                </button>
              ) : (
                <button
                  onClick={this.onEdit}
                  title="Edit details (alt text, caption)"
                  className="pointer-events-auto cursor-pointer p-2 bg-white rounded-lg text-slate-900 hover:bg-slate-100 transition-colors"
                >
                  <FrameworkIcons.Edit size={18} />
                </button>
              )}
              {this.isReadOnly
                ? this.renderLockedAction(<FrameworkIcons.External size={18} />, 'text-indigo-600', 'Ships with the theme — it lives in the theme bundle, not in a media folder')
                : (
                  <button
                    onClick={this.onMove}
                    title="Move to folder"
                    className="pointer-events-auto cursor-pointer p-2 bg-white rounded-lg text-indigo-600 hover:bg-indigo-50 transition-colors"
                  >
                    <FrameworkIcons.External size={18} />
                  </button>
                )}
              {this.isReadOnly
                ? this.renderLockedAction(<FrameworkIcons.Trash size={18} />, 'text-red-600', 'Ships with the theme — remove it by changing the theme, not from the library')
                : (
                  <button
                    onClick={this.onDelete}
                    title="Delete"
                    className="pointer-events-auto cursor-pointer p-2 bg-white rounded-lg text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <FrameworkIcons.Trash size={18} />
                  </button>
                )}
          </div>
        </div>
        <div className="p-4">
          <div className={`font-semibold text-sm truncate ${theme === ThemeMode.DARK ? 'text-slate-200' : 'text-slate-900'}`} title={item.originalName}>
            {item.originalName}
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-[10px] text-slate-500 font-medium tracking-wide">{this.sizeLabel}</span>
            <div className="flex items-center gap-1">
              {/* Why this card has no Edit/Move/Delete. Without it the operator sees controls missing
                  from some tiles and not others with nothing on screen accounting for the difference. */}
              {this.isReadOnly ? (
                <Badge variant={BadgeVariant.GRAY} className="text-[10px]">Theme</Badge>
              ) : null}
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
              title="Open details"
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
            {this.isReadOnly ? <Badge variant={BadgeVariant.GRAY} className="text-[10px]">Theme</Badge> : null}
            {String(item.visibility || 'public') === 'private' ? (
              <Badge variant={BadgeVariant.WARNING} className="text-[10px]">Private</Badge>
            ) : null}
            {item.optimizedUrl ? <Badge variant={BadgeVariant.SUCCESS} className="text-[10px]">WebP</Badge> : null}
         </div>
         <div className="flex items-center gap-0.5 flex-shrink-0">
            {/* The row's counterpart to the grid bar's Details — see the note there. */}
            {this.isReadOnly ? (
              <button
                onClick={this.onEdit}
                title="Details"
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
                {this.renderLockedAction(<FrameworkIcons.Zap size={16} />, 'text-emerald-500', 'Ships with the theme — there is no media record to store an optimized copy on', 'bg-transparent')}
                {this.renderLockedAction(<FrameworkIcons.External size={16} />, 'text-indigo-500', 'Ships with the theme — it lives in the theme bundle, not in a media folder', 'bg-transparent')}
                {this.renderLockedAction(<FrameworkIcons.Trash size={16} />, 'text-red-500', 'Ships with the theme — remove it by changing the theme, not from the library', 'bg-transparent')}
              </>
            ) : (
              <>
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
                  title="Move to folder"
                  className="p-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg text-indigo-500"
                >
                  <FrameworkIcons.External size={16} />
                </button>
                <button
                  onClick={this.onDelete}
                  title="Delete"
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

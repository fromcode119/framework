import { MovingItemType } from '@/app/media/enums/moving-item-type.enum';
import { ThemeMode } from '@fromcode119/core/client';
import { ViewMode } from '@/app/media/enums/view-mode.enum';
import type React from 'react';
import { PureReactor, prop, state, bound } from '@fromcode119/react-class-components';
import { AdminServices } from '@/lib/admin-services';
import type { IMediaItem } from '@/app/media/interfaces/media-item.interface';
import type { IMovingItem } from '@/app/media/interfaces/moving-item.interface';

/**
 * What one media card knows about its file, and what it may do with it.
 *
 * The base of this card's chain: the markup sits above it.
 *
 * A PRIVATE file has no public URL, so it gets no `<img>` preview — asking for one would 403 and
 * paint a broken image over a file that is perfectly fine. A read-only card states WHY each action is
 * unavailable rather than hiding the action, so the operator can tell "you may not" from "this does
 * not exist".
 */
export abstract class MediaItemCardState extends PureReactor {
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
  protected get isReadOnly(): boolean {
    return Boolean(this.item.readOnly);
  }

  /**
   * The uploaded record's numeric id.
   *
   * Only ever read on write paths — select, move, delete, optimize — and every one of those is
   * withheld for a read-only theme asset, whose id is a `theme:<path>` string. So by the time this is
   * called the id IS numeric.
   */
  protected get uploadId(): number {
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
  protected get isPrivate(): boolean {
    return String(this.item.visibility || 'public') === 'private';
  }

  protected get mediaUrl(): string {
    return AdminServices.getInstance().media.resolveMediaUrl(this.item.url);
  }

  protected get previewUrl(): string {
    return AdminServices.getInstance().media.resolvePreviewUrl(this.item);
  }

  /**
   * Set when the bytes cannot be loaded, so the card shows the generic file icon instead of the
   * browser's broken-image glyph — which reads as a bug in the page rather than as a missing file.
   */
  @state protected imageFailed = false;

  @bound
  onImageError(): void {
    this.imageFailed = true;
  }

  protected formatSize(bytes: number): string {
    return AdminServices.getInstance().formatter.formatSize(bytes);
  }

  /** Size only when it is KNOWN: `0` here means "not reported", and "0 B" would read as a real answer. */
  protected get sizeLabel(): string {
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
  protected renderLockedAction(icon: React.ReactNode, tone: string, reason: string, shell = 'bg-white'): React.ReactNode {
    return (
      <span className="pointer-events-auto inline-flex" title={reason}>
        <button type="button" disabled aria-disabled className={`cursor-not-allowed p-2 rounded-lg opacity-40 ${shell} ${tone}`}>
          {icon}
        </button>
      </span>
    );
  }
}

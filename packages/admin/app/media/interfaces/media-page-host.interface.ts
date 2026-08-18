import type { IMediaFolder } from '@/app/media/interfaces/media-folder.interface';
import type { IMediaItem } from '@/app/media/interfaces/media-item.interface';
import type { IMediaPageClientState } from '@/app/media/interfaces/media-page-client-state.interface';
import type { IMovingItem } from '@/app/media/interfaces/moving-item.interface';

/**
 * What {@link MediaPageActions} needs from the page-client to drive it, hook-free.
 *
 * The contract names the members it reads rather than exposing a `state` bag — the page-client holds
 * them as `@state` fields, so the actions class reads `host.searchQuery`, not `host.state.searchQuery`.
 */
export interface IMediaPageHost {
  /** True between `componentDidMount` and `componentWillUnmount`. */
  readonly mounted: boolean;
  /** The page of items currently loaded — `loadMore` appends to it rather than replacing. */
  readonly items: IMediaItem[];
  /** Whether the server has another page. Derived from a full page, not from a total. */
  readonly hasMore: boolean;
  readonly loadingMore: boolean;
  readonly searchQuery: string;
  readonly currentFolderId: number | null;
  readonly editingFolder: IMediaFolder | null;
  readonly movingItem: IMovingItem | null;
  readonly deletingId: number | null;
  readonly editingItem: IMediaItem | null;
  /** Raw `setState` pass-through — deliberately UNGUARDED; callers keep the `mounted` check explicit. */
  patch(patch: Partial<IMediaPageClientState>): void;
  patchWith(updater: (state: IMediaPageClientState) => Partial<IMediaPageClientState>): void;
  /** Re-read the current folder/search view into state. */
  refresh(): Promise<void>;
}

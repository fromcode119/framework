import { ViewMode } from '@/app/media/enums/view-mode.enum';

import type { IMediaFolder } from '@/app/media/interfaces/media-folder.interface';
import type { IMediaItem } from '@/app/media/interfaces/media-item.interface';
import type { IMovingItem } from '@/app/media/interfaces/moving-item.interface';

export interface IMediaPageClientState {
  items: IMediaItem[];
  folders: IMediaFolder[];
  currentFolderId: number | null;
  folderPath: IMediaFolder[];
  loading: boolean;
  uploading: boolean;
  searchQuery: string;
  viewMode: ViewMode;
  error: string | null;
  isDragOver: boolean;
  isFolderPromptOpen: boolean;
  isRenamePromptOpen: boolean;
  isDeleteDialogOpen: boolean;
  isFolderDeleteDialogOpen: boolean;
  isMoveDialogOpen: boolean;
  deletingId: number | null;
  editingFolder: IMediaFolder | null;
  editingItem: IMediaItem | null;
  movingItem: IMovingItem | null;
  isActionLoading: boolean;
  optimizingId: number | null;
}

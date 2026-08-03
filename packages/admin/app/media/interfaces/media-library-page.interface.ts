
import type { IMediaFolder } from '@/app/media/interfaces/media-folder.interface';
import type { IMediaItem } from '@/app/media/interfaces/media-item.interface';

export interface IMediaLibraryPage {
  items: IMediaItem[];
  folders: IMediaFolder[];
}

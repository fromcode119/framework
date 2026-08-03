import { NotificationType } from '@/components/enums/notification-type.enum';

export interface ICollectionListPageViewState {
  data: any[];
  pluginSettings: Record<string, any>;
  total: number;
  loading: boolean;
  search: string;
  debouncedSearch: string;
  page: number;
  sort: string;
  selectedIds: string[];
  statusFilter: string;
  fieldFilters: Record<string, string>;
  visibleColumnIds: string[];
  showColumnsMenu: boolean;
  quickEditExpandedId: string | null;
  quickEditLoadingId: string | null;
  quickEditSavingId: string | null;
  quickEditData: Record<string, any>;
  quickEditInitialData: Record<string, any>;
  quickEditStatus: { type: NotificationType; message: string } | null;
  deleteDialogState: { mode: 'single'; id: string } | { mode: 'bulk'; ids: string[] } | null;
  deleteLoading: boolean;
}

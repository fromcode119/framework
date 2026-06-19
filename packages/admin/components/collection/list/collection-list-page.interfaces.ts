import type React from 'react';

export interface CollectionListPageViewState {
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
  quickEditStatus: { type: 'success' | 'error'; message: string } | null;
  deleteDialogState: { mode: 'single'; id: string } | { mode: 'bulk'; ids: string[] } | null;
  deleteLoading: boolean;
}

export interface CollectionListPageViewProps {
  pluginSlug: string;
  slug: string;
  router: any;
  pathname: string;
  searchParams: URLSearchParams;
  collections: any;
  settings: any;
  theme: any;
}

export interface CollectionListPageViewModel {
  router: any;
  settings: any;
  theme: any;
  columnsMenuRef: React.RefObject<HTMLDivElement>;
  collection: any;
  resolvedSlug: string;
  slotSlug: string;
  pageSize: number;
  frontendUrl: string;
  data: any[];
  pluginSettings: Record<string, any>;
  total: number;
  loading: boolean;
  search: string;
  setSearch: React.Dispatch<React.SetStateAction<string>>;
  page: number;
  setPage: React.Dispatch<React.SetStateAction<number>>;
  sort: string;
  handleSort: (newSort: string) => void;
  selectedIds: string[];
  setSelectedIds: React.Dispatch<React.SetStateAction<string[]>>;
  statusFilter: string;
  setStatusFilter: React.Dispatch<React.SetStateAction<string>>;
  fieldFilters: Record<string, string>;
  setFieldFilters: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  visibleColumnIds: string[];
  setVisibleColumnIds: React.Dispatch<React.SetStateAction<string[]>>;
  showColumnsMenu: boolean;
  setShowColumnsMenu: React.Dispatch<React.SetStateAction<boolean>>;
  quickEditExpandedId: string | null;
  setQuickEditExpandedId: React.Dispatch<React.SetStateAction<string | null>>;
  quickEditLoadingId: string | null;
  setQuickEditLoadingId: React.Dispatch<React.SetStateAction<string | null>>;
  quickEditSavingId: string | null;
  setQuickEditSavingId: React.Dispatch<React.SetStateAction<string | null>>;
  quickEditData: Record<string, any>;
  setQuickEditData: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  quickEditInitialData: Record<string, any>;
  setQuickEditInitialData: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  quickEditStatus: { type: 'success' | 'error'; message: string } | null;
  setQuickEditStatus: React.Dispatch<React.SetStateAction<{ type: 'success' | 'error'; message: string } | null>>;
  quickEditFields: any[];
  deleteDialogState: { mode: 'single'; id: string } | { mode: 'bulk'; ids: string[] } | null;
  setDeleteDialogState: React.Dispatch<React.SetStateAction<{ mode: 'single'; id: string } | { mode: 'bulk'; ids: string[] } | null>>;
  deleteLoading: boolean;
  setDeleteLoading: React.Dispatch<React.SetStateAction<boolean>>;
  statusOptions: any[];
  allColumns: any[];
  selectFilterFields: any[];
  columns: any[];
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  fetchData: (targetPage?: number) => Promise<void>;
  handleExport: (format: 'json' | 'csv', ids?: string[]) => Promise<void>;
}

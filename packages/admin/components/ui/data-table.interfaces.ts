import type React from 'react';

export interface Column<T> {
  header: string;
  accessor: keyof T | ((row: T) => React.ReactNode);
  id: string;
  sortable?: boolean;
  className?: string;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  totalDocs?: number;
  limit?: number;
  page?: number;
  onPageChange?: (page: number) => void;
  onSort?: (sort: string) => void;
  currentSort?: string;
  onRowClick?: (row: T) => void;
  actions?: (row: T) => React.ReactNode;
  emptyMessage?: string;
  selectable?: boolean;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  expandedRowId?: string | null;
  renderExpandedRow?: (row: T) => React.ReactNode;
  /**
   * When provided, rows are visually grouped: a full-width header row is emitted before each run of
   * rows that share a group key. Callers must pass `data` already sorted by the same key so a group's
   * rows are contiguous. Returns the group label for a row.
   */
  groupBy?: (row: T) => string;
}

export interface DataTablePaginationProps {
  totalDocs: number;
  limit: number;
  page: number;
  onPageChange?: (page: number) => void;
}

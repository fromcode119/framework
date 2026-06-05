"use client";

import React, { use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ContextHooks } from '@fromcode119/react';

import { CollectionNotFound } from '@/components/collection/collection-not-found';
import { ThemeHooks } from '@/components/use-theme';
import { AdminApi } from '@/lib/api';
import { AdminServices } from '@/lib/admin-services';
import { AdminCollectionUtils } from '@/lib/collection-utils';
import { AdminConstants } from '@/lib/constants';
import { AdminUrlUtils } from '@/lib/url-utils';

import { CollectionListPageActions } from './page-actions';
import { CollectionListPageLayout } from './page-layout';
import { CollectionListPageService } from './page-service';
import { CollectionListUtils } from './utils';

const adminServices = AdminServices.getInstance();

export function CollectionListPageClient({
  params
}: {
  params: Promise<{ pluginSlug: string; slug: string }>;
}) {
  const { pluginSlug, slug } = use(params);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const collections = ContextHooks.useCollections();
  const settings = ContextHooks.useGlobalSettings();
  const { theme } = ThemeHooks.useTheme();
  const columnsMenuRef = useRef<HTMLDivElement>(null);
  const collection = AdminCollectionUtils.resolveCollection(collections, pluginSlug, slug);
  const resolvedSlug = collection?.slug || slug;
  const slotSlug = (collection as any)?.unprefixedSlug || slug;
  const pageSize = 10;
  const frontendUrl = AdminUrlUtils.resolveFrontendBaseUrl(settings, settings?.frontend_url);
  const [data, setData] = useState<any[]>([]);
  const [pluginSettings, setPluginSettings] = useState<Record<string, any>>({});
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState<number>(() => {
    if (typeof window === 'undefined') return 1;
    return CollectionListUtils.parsePageQueryValue(new URLSearchParams(window.location.search).get('page'));
  });
  const [sort, setSort] = useState('-createdAt');

  const handleSort = useCallback((newSort: string) => {
    adminServices.uiPreference.writeCollectionSort(pluginSlug, resolvedSlug, newSort);
    setSort(newSort);
  }, [pluginSlug, resolvedSlug]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [fieldFilters, setFieldFilters] = useState<Record<string, string>>({});
  const [visibleColumnIds, setVisibleColumnIds] = useState<string[]>([]);
  const [showColumnsMenu, setShowColumnsMenu] = useState(false);
  const [quickEditExpandedId, setQuickEditExpandedId] = useState<string | null>(null);
  const [quickEditLoadingId, setQuickEditLoadingId] = useState<string | null>(null);
  const [quickEditSavingId, setQuickEditSavingId] = useState<string | null>(null);
  const [quickEditData, setQuickEditData] = useState<Record<string, any>>({});
  const [quickEditInitialData, setQuickEditInitialData] = useState<Record<string, any>>({});
  const [quickEditStatus, setQuickEditStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [deleteDialogState, setDeleteDialogState] = useState<{ mode: 'single'; id: string } | { mode: 'bulk'; ids: string[] } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const statusField = useMemo(() => CollectionListPageService.resolveStatusField(collection), [collection]);
  const statusOptions = useMemo(() => CollectionListPageService.resolveStatusOptions(statusField), [statusField]);
  const allColumns = useMemo(() => CollectionListPageService.buildAllColumns(collection), [collection]);
  const selectFilterFields = useMemo(() => CollectionListPageService.resolveSelectFilterFields(collection), [collection]);
  const quickEditFields = useMemo(() => CollectionListPageService.resolveQuickEditFields(collection), [collection]);
  const columns = useMemo(() => {
    const columnById = new Map(allColumns.map((col) => [col.id, col]));
    const ordered = visibleColumnIds.map((id) => columnById.get(id)).filter(Boolean);
    return ordered.length ? ordered : allColumns.slice(0, 1);
  }, [allColumns, visibleColumnIds]);

  useEffect(() => {
    if (collection?.type === 'global') router.replace(`/${pluginSlug}/${slug}/settings`);
  }, [collection, pluginSlug, slug, router]);

  useEffect(() => {
    const pageFromUrl = CollectionListUtils.parsePageQueryValue(searchParams.get('page'));
    setPage((prev) => (prev === pageFromUrl ? prev : pageFromUrl));
  }, [searchParams]);

  useEffect(() => {
    const nextParams = new URLSearchParams(searchParams.toString());
    if (page <= 1) nextParams.delete('page');
    else nextParams.set('page', String(page));
    const nextQuery = nextParams.toString();
    if (nextQuery !== searchParams.toString()) {
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
    }
  }, [page, pathname, router, searchParams]);

  useEffect(() => {
    if (!allColumns.length) return;
    const next = CollectionListPageService.resolveVisibleColumnIds({
      allColumns,
      adminDefaultColumns: collection?.admin?.defaultColumns,
      persistedColumns: adminServices.uiPreference.readCollectionColumns(pluginSlug, resolvedSlug)
    });
    setVisibleColumnIds((prev) => CollectionListUtils.areStringArraysEqual(prev, next) ? prev : next);
  }, [allColumns, collection?.admin?.defaultColumns, pluginSlug, resolvedSlug]);

  useEffect(() => {
    if (!collection) return;
    const persisted = adminServices.uiPreference.readCollectionSort(pluginSlug, resolvedSlug);
    if (persisted) { setSort(persisted); return; }
    const defaultSort = (collection?.admin as any)?.defaultSort;
    if (defaultSort) setSort(String(defaultSort));
  }, [collection, pluginSlug, resolvedSlug]);

  useEffect(() => {
    if (!showColumnsMenu) return;
    const onClickOutside = (event: MouseEvent) => {
      if (columnsMenuRef.current && !columnsMenuRef.current.contains(event.target as Node)) setShowColumnsMenu(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [showColumnsMenu]);

  useEffect(() => {
    const next = selectFilterFields.length ? Object.fromEntries(selectFilterFields.map((field: any) => [field.name, 'all'])) : {};
    setFieldFilters((prev) => CollectionListUtils.areStringRecordMapsEqual(prev, next) ? prev : next);
  }, [resolvedSlug, selectFilterFields]);

  useEffect(() => {
    CollectionListPageService.loadPluginSettings(collection?.pluginSlug)
      .then((response) => setPluginSettings(response))
      .catch((error) => console.error('Failed to load plugin settings:', error));
  }, [collection?.pluginSlug]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (debouncedSearch !== search) {
        setDebouncedSearch(search);
        setPage((prev) => (prev === 1 ? prev : 1));
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [debouncedSearch, search]);

  const fetchData = useCallback(async (targetPage = page) => {
    setLoading(true);
    try {
      const result = await CollectionListPageService.fetchCollectionData({
        resolvedSlug,
        targetPage,
        pageSize,
        search: debouncedSearch,
        sort,
        statusFilter,
        fieldFilters
      });
      setData(result.docs);
      setTotal(result.totalDocs);
    } catch (error) {
      console.error('Failed to fetch collection data:', error);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, fieldFilters, page, resolvedSlug, sort, statusFilter]);

  useEffect(() => {
    fetchData(page);
  }, [fetchData, page]);

  if (!collection) return <CollectionNotFound theme={theme as any} slug={slug} pluginSlug={pluginSlug} />;

  const handleExport = async (format: 'json' | 'csv', ids?: string[]) => {
    const queryParams = new URLSearchParams({ format, token: AdminApi.getAdminExportToken() });
    if (ids?.length) queryParams.append('ids', ids.join(','));
    window.open(`${AdminApi.getBaseUrl()}${AdminConstants.ENDPOINTS.COLLECTIONS.BASE}/${resolvedSlug}/export?${queryParams.toString()}`, '_blank');
  };

  return (
    <CollectionListPageLayout
      collection={collection}
      pluginSlug={pluginSlug}
      slug={slug}
      slotSlug={slotSlug}
      resolvedSlug={resolvedSlug}
      total={total}
      page={page}
      search={search}
      theme={theme}
      toolbarProps={{
        filterBarProps: {
          collection,
          slug,
          theme,
          search,
          setSearch,
          statusFilter,
          setStatusFilter,
          statusOptions,
          setPage,
          showColumnsMenu,
          setShowColumnsMenu,
          columnsMenuRef,
          allColumns,
          visibleColumnIds,
          toggleColumn: (columnId: string) => CollectionListPageActions.toggleColumn({ columnId, pluginSlug, resolvedSlug, setVisibleColumnIds }),
          reorderColumn: (columnId: string, direction: 'up' | 'down') => CollectionListPageActions.reorderColumn({ columnId, direction, pluginSlug, resolvedSlug, setVisibleColumnIds }),
          selectFilterFields,
          fieldFilters,
          setFieldFilters,
          prettifyColumnName: CollectionListUtils.prettifyColumnName
        },
        bulkActionsProps: {
          selectedIds,
          statusOptions,
          handleBulkStatusChange: (newStatus: string) => CollectionListPageActions.handleBulkStatusChange({ resolvedSlug, selectedIds, newStatus, page, setLoading, setSelectedIds, fetchData }),
          handleExport,
          handleBulkDelete: () => selectedIds.length && setDeleteDialogState({ mode: 'bulk', ids: [...selectedIds] }),
          setSelectedIds
        }
      }}
      tableProps={{
        collection,
        pluginSlug,
        slug,
        slotSlug,
        resolvedSlug,
        theme,
        total,
        page,
        search,
        columns,
        data,
        loading,
        sort,
        onPageChange: setPage,
        onSort: handleSort,
        onRowClick: (row: any) => router.push(`/${pluginSlug}/${slug}/${row.id}`),
        selectedIds,
        setSelectedIds,
        quickEditExpandedId,
        quickEditLoadingId,
        quickEditSavingId,
        quickEditData,
        setQuickEditData,
        quickEditStatus,
        quickEditFields,
        pluginSettings,
        frontendUrl,
        permalinkStructure: settings?.permalink_structure,
        onDelete: (id: string, event: React.MouseEvent) => {
          event.stopPropagation();
          setDeleteDialogState({ mode: 'single', id });
        },
        onQuickEditOpen: (row: any, event: React.MouseEvent) => CollectionListPageActions.handleQuickEditOpen({
          row,
          event,
          resolvedSlug,
          quickEditExpandedId,
          setQuickEditExpandedId,
          setQuickEditStatus,
          setQuickEditLoadingId,
          setQuickEditData,
          setQuickEditInitialData
        }),
        onQuickEditSave: () => CollectionListPageActions.handleQuickEditSave({
          quickEditExpandedId,
          quickEditData,
          quickEditInitialData,
          resolvedSlug,
          page,
          setQuickEditSavingId,
          setQuickEditStatus,
          setQuickEditInitialData,
          fetchData
        }),
        onQuickEditClose: () => setQuickEditExpandedId(null)
      }}
      footerProps={{
        theme,
        slug,
        total,
        resolvedSlug,
        handleExport,
        handleImport: (event: React.ChangeEvent<HTMLInputElement>) => CollectionListPageActions.handleImport(event, resolvedSlug)
      }}
      deleteDialogProps={{
        deleteDialogState,
        deleteLoading,
        onClose: () => {
          if (!deleteLoading) setDeleteDialogState(null);
        },
        onConfirm: () => CollectionListPageActions.handleDeleteConfirm({
          deleteDialogState,
          resolvedSlug,
          total,
          page,
          pageSize,
          quickEditExpandedId,
          setDeleteLoading,
          setDeleteDialogState,
          setSelectedIds,
          setQuickEditExpandedId,
          setQuickEditStatus,
          setPage,
          fetchData
        })
      }}
    />
  );
}

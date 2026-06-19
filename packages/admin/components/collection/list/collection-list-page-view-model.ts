"use client";

import { AdminCollectionUtils } from '@/lib/collection-utils';
import { AdminUrlUtils } from '@/lib/url-utils';

import { CollectionListPageService } from './page-service';
import type { CollectionListPageViewModel } from './collection-list-page.interfaces';

/**
 * Assembles the `CollectionListPageViewModel` consumed by `CollectionListPageProps.build`. Derived
 * values (status field/options, columns, filter fields) are computed here per render — they are cheap
 * and pure. `self` is the `CollectionListPageView` instance (typed loosely to avoid a circular import).
 */
export class CollectionListPageViewModelBuilder {
  static build(self: any): CollectionListPageViewModel {
    const { pluginSlug, slug, router, settings, theme } = self.props;
    const collection = AdminCollectionUtils.resolveCollection(self.props.collections, pluginSlug, slug);
    const resolvedSlug = collection?.slug || slug;
    const slotSlug = (collection as any)?.unprefixedSlug || slug;
    const frontendUrl = AdminUrlUtils.resolveFrontendBaseUrl(settings, settings?.frontend_url);

    const statusField = CollectionListPageService.resolveStatusField(collection);
    const statusOptions = CollectionListPageService.resolveStatusOptions(statusField);
    const allColumns = CollectionListPageService.buildAllColumns(collection);
    const selectFilterFields = CollectionListPageService.resolveSelectFilterFields(collection);
    const quickEditFields = CollectionListPageService.resolveQuickEditFields(collection);
    const columnById = new Map(allColumns.map((col: any) => [col.id, col]));
    const ordered = self.state.visibleColumnIds.map((id: string) => columnById.get(id)).filter(Boolean);
    const columns = ordered.length ? ordered : allColumns.slice(0, 1);

    return {
      router, settings, theme, columnsMenuRef: self.columnsMenuRef, collection, resolvedSlug, slotSlug,
      pageSize: self.pageSize, frontendUrl,
      data: self.state.data, pluginSettings: self.state.pluginSettings, total: self.state.total, loading: self.state.loading,
      search: self.state.search, setSearch: (v: any) => self.updateState('search', v),
      page: self.state.page, setPage: (v: any) => self.updateState('page', v),
      sort: self.state.sort, handleSort: (newSort: string) => self.handleSort(newSort),
      selectedIds: self.state.selectedIds, setSelectedIds: (v: any) => self.updateState('selectedIds', v),
      statusFilter: self.state.statusFilter, setStatusFilter: (v: any) => self.updateState('statusFilter', v),
      fieldFilters: self.state.fieldFilters, setFieldFilters: (v: any) => self.updateState('fieldFilters', v),
      visibleColumnIds: self.state.visibleColumnIds, setVisibleColumnIds: (v: any) => self.updateState('visibleColumnIds', v),
      showColumnsMenu: self.state.showColumnsMenu, setShowColumnsMenu: (v: any) => self.updateState('showColumnsMenu', v),
      quickEditExpandedId: self.state.quickEditExpandedId, setQuickEditExpandedId: (v: any) => self.updateState('quickEditExpandedId', v),
      quickEditLoadingId: self.state.quickEditLoadingId, setQuickEditLoadingId: (v: any) => self.updateState('quickEditLoadingId', v),
      quickEditSavingId: self.state.quickEditSavingId, setQuickEditSavingId: (v: any) => self.updateState('quickEditSavingId', v),
      quickEditData: self.state.quickEditData, setQuickEditData: (v: any) => self.updateState('quickEditData', v),
      quickEditInitialData: self.state.quickEditInitialData, setQuickEditInitialData: (v: any) => self.updateState('quickEditInitialData', v),
      quickEditStatus: self.state.quickEditStatus, setQuickEditStatus: (v: any) => self.updateState('quickEditStatus', v),
      quickEditFields, deleteDialogState: self.state.deleteDialogState, setDeleteDialogState: (v: any) => self.updateState('deleteDialogState', v),
      deleteLoading: self.state.deleteLoading, setDeleteLoading: (v: any) => self.updateState('deleteLoading', v),
      statusOptions, allColumns, selectFilterFields, columns,
      setLoading: (v: any) => self.updateState('loading', v),
      fetchData: (targetPage?: number) => self.fetchData(targetPage),
      handleExport: (format: 'json' | 'csv', ids?: string[]) => self.handleExport(format, ids)
    };
  }
}

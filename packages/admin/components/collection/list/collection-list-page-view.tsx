"use client";

import React from 'react';

import { AdminApi } from '@/lib/api';
import { AdminServices } from '@/lib/admin-services';
import { AdminCollectionUtils } from '@/lib/collection-utils';
import { AdminConstants } from '@/lib/constants';
import { CollectionNotFound } from '@/components/collection/collection-not-found';

import { CollectionListPageLayout } from './page-layout';
import { CollectionListPageProps } from './page-client-props';
import { CollectionListPageService } from './page-service';
import { CollectionListPageLifecycle } from './collection-list-page-lifecycle';
import { CollectionListPageViewModelBuilder } from './collection-list-page-view-model';
import { CollectionListUtils } from './utils';
import type { CollectionListPageViewProps, CollectionListPageViewState } from './collection-list-page.interfaces';

export class CollectionListPageView extends React.Component<CollectionListPageViewProps, CollectionListPageViewState> {
  readonly pageSize = 10;
  readonly columnsMenuRef = React.createRef<HTMLDivElement>();
  private searchTimer: any = null;
  private onClickOutside: ((event: MouseEvent) => void) | null = null;

  constructor(props: CollectionListPageViewProps) {
    super(props);
    const initialPage = typeof window === 'undefined'
      ? 1
      : CollectionListUtils.parsePageQueryValue(new URLSearchParams(window.location.search).get('page'));
    this.state = {
      data: [], pluginSettings: {}, total: 0, loading: true, search: '', debouncedSearch: '',
      page: initialPage, sort: '-createdAt', selectedIds: [], statusFilter: 'all', fieldFilters: {},
      visibleColumnIds: [], showColumnsMenu: false, quickEditExpandedId: null, quickEditLoadingId: null,
      quickEditSavingId: null, quickEditData: {}, quickEditInitialData: {}, quickEditStatus: null,
      deleteDialogState: null, deleteLoading: false
    };
  }

  componentDidMount(): void {
    CollectionListPageLifecycle.onMount(this);
  }

  componentDidUpdate(prevProps: CollectionListPageViewProps, prevState: CollectionListPageViewState): void {
    CollectionListPageLifecycle.onUpdate(this, prevProps, prevState);
  }

  componentWillUnmount(): void {
    CollectionListPageLifecycle.onUnmount(this);
  }

  updateState<K extends keyof CollectionListPageViewState>(key: K, value: React.SetStateAction<CollectionListPageViewState[K]>): void {
    this.setState((prev) => ({ [key]: typeof value === 'function' ? (value as any)(prev[key]) : value }) as Pick<CollectionListPageViewState, K>);
  }

  handleSort(newSort: string): void {
    const collection = AdminCollectionUtils.resolveCollection(this.props.collections, this.props.pluginSlug, this.props.slug);
    const resolvedSlug = collection?.slug || this.props.slug;
    AdminServices.getInstance().uiPreference.writeCollectionSort(this.props.pluginSlug, resolvedSlug, newSort);
    this.updateState('sort', newSort);
  }

  async fetchData(targetPage?: number): Promise<void> {
    const collection = AdminCollectionUtils.resolveCollection(this.props.collections, this.props.pluginSlug, this.props.slug);
    const resolvedSlug = collection?.slug || this.props.slug;
    const page = targetPage ?? this.state.page;
    this.updateState('loading', true);
    try {
      const result = await CollectionListPageService.fetchCollectionData({
        resolvedSlug, targetPage: page, pageSize: this.pageSize,
        search: this.state.debouncedSearch, sort: this.state.sort,
        statusFilter: this.state.statusFilter, fieldFilters: this.state.fieldFilters
      });
      this.setState({ data: result.docs, total: result.totalDocs });
    } catch (error) {
      console.error('Failed to fetch collection data:', error);
    } finally {
      this.updateState('loading', false);
    }
  }

  async handleExport(format: 'json' | 'csv', ids?: string[]): Promise<void> {
    const collection = AdminCollectionUtils.resolveCollection(this.props.collections, this.props.pluginSlug, this.props.slug);
    const resolvedSlug = collection?.slug || this.props.slug;
    const queryParams = new URLSearchParams({ format, token: AdminApi.getAdminExportToken() });
    if (ids?.length) queryParams.append('ids', ids.join(','));
    window.open(`${AdminApi.getBaseUrl()}${AdminConstants.ENDPOINTS.COLLECTIONS.BASE}/${resolvedSlug}/export?${queryParams.toString()}`, '_blank');
  }

  render(): React.ReactNode {
    const { pluginSlug, slug, theme } = this.props;
    const collection = AdminCollectionUtils.resolveCollection(this.props.collections, pluginSlug, slug);
    if (!collection) return <CollectionNotFound theme={theme as any} slug={slug} pluginSlug={pluginSlug} />;

    const viewModel = CollectionListPageViewModelBuilder.build(this);
    const { toolbarProps, tableProps, footerProps, deleteDialogProps } = CollectionListPageProps.build({ pluginSlug, slug, state: viewModel });

    return (
      <CollectionListPageLayout
        collection={collection}
        pluginSlug={pluginSlug}
        slug={slug}
        slotSlug={viewModel.slotSlug}
        resolvedSlug={viewModel.resolvedSlug}
        total={viewModel.total}
        page={viewModel.page}
        search={viewModel.search}
        theme={theme}
        toolbarProps={toolbarProps}
        tableProps={tableProps}
        footerProps={footerProps}
        deleteDialogProps={deleteDialogProps}
      />
    );
  }
}

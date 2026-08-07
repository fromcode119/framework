import { ExportFormat } from '@/components/collection/list/enums/export-format.enum';
import { NotificationType } from '@/components/enums/notification-type.enum';
import type { ReactNode } from 'react';
import { Reactor, prop, ref, state } from '@fromcode119/reactor';
import type { Ref } from '@fromcode119/reactor';

import { AdminServices } from '@/lib/admin-services';
import { AdminCollectionUtils } from '@/lib/collection-utils';
import { CollectionNotFound } from '@/components/collection/view/collection-not-found.client';

import { CollectionListPageLayout } from '@/components/collection/list/view/page-layout.client';
import { CollectionListPageProps } from '@/components/collection/list/page-client-props';
import { CollectionListPageService } from '@/components/collection/list/page-service';
import { CollectionListPageLifecycle } from '@/components/collection/list/view/collection-list-page-lifecycle.client';
import { CollectionListPageViewModelBuilder } from '@/components/collection/list/view/collection-list-page-view-model.client';
import { CollectionListUtils } from '@/components/collection/list/utils';

export class CollectionListPageView extends Reactor {
  @prop declare pluginSlug: string;
  @prop declare slug: string;
  @prop declare router: any;
  @prop declare pathname: string;
  @prop declare searchParams: URLSearchParams;
  @prop declare collections: any;
  @prop declare settings: any;
  @prop declare theme: any;

  @state data: any[] = [];
  @state pluginSettings: Record<string, any> = {};
  @state total = 0;
  @state loading = true;
  /** Set when the list could not be loaded, so an empty table is never passed off as "no records". */
  @state loadError = '';
  @state search = '';
  @state debouncedSearch = '';
  @state page = typeof window === 'undefined'
    ? 1
    : CollectionListUtils.parsePageQueryValue(new URLSearchParams(window.location.search).get('page'));
  @state sort = '-createdAt';
  @state selectedIds: string[] = [];
  @state statusFilter = 'all';
  @state fieldFilters: Record<string, string> = {};
  @state visibleColumnIds: string[] = [];
  @state showColumnsMenu = false;
  @state quickEditExpandedId: string | null = null;
  @state quickEditLoadingId: string | null = null;
  @state quickEditSavingId: string | null = null;
  @state quickEditData: Record<string, any> = {};
  @state quickEditInitialData: Record<string, any> = {};
  @state quickEditStatus: { type: NotificationType; message: string } | null = null;
  @state deleteDialogState: { mode: 'single'; id: string } | { mode: 'bulk'; ids: string[] } | null = null;
  @state deleteLoading = false;

  readonly pageSize = 10;
  @ref declare columnsMenuRef: Ref<HTMLDivElement>;
  private searchTimer: any = null;
  private onClickOutside: ((event: MouseEvent) => void) | null = null;

  componentDidMount(): void {
    CollectionListPageLifecycle.onMount(this);
  }

  componentDidUpdate(prevProps: object, prevState: object): void {
    CollectionListPageLifecycle.onUpdate(this, prevProps as any, prevState as any);
  }

  componentWillUnmount(): void {
    CollectionListPageLifecycle.onUnmount(this);
  }

  updateState(key: string, value: unknown): void {
    this.setState((prev: Record<string, unknown>) => ({
      [key]: typeof value === 'function' ? (value as (previous: unknown) => unknown)(prev[key]) : value
    }));
  }

  handleSort(newSort: string): void {
    const collection = AdminCollectionUtils.resolveCollection(this.collections, this.pluginSlug, this.slug);
    const resolvedSlug = collection?.slug || this.slug;
    AdminServices.getInstance().uiPreference.writeCollectionSort(this.pluginSlug, resolvedSlug, newSort);
    this.updateState('sort', newSort);
  }

  async fetchData(targetPage?: number): Promise<void> {
    const collection = AdminCollectionUtils.resolveCollection(this.collections, this.pluginSlug, this.slug);
    const resolvedSlug = collection?.slug || this.slug;
    const page = targetPage ?? this.page;
    this.updateState('loading', true);
    try {
      const result = await CollectionListPageService.fetchCollectionData({
        resolvedSlug, targetPage: page, pageSize: this.pageSize,
        search: this.debouncedSearch, sort: this.sort,
        statusFilter: this.statusFilter, fieldFilters: this.fieldFilters
      });
      this.loadError = '';
      this.data = result.docs;
      this.total = result.totalDocs;
    } catch (error: any) {
      // Without this the table fell back to "No records found" — a positive claim that the collection
      // is empty, when in fact the request failed.
      console.error('Failed to fetch collection data:', error);
      this.loadError = error?.message || 'The records could not be loaded.';
    } finally {
      this.updateState('loading', false);
    }
  }

  async handleExport(format: ExportFormat, ids?: string[]): Promise<void> {
    const collection = AdminCollectionUtils.resolveCollection(this.collections, this.pluginSlug, this.slug);
    const resolvedSlug = collection?.slug || this.slug;
    try {
      await CollectionListPageService.exportRecords(resolvedSlug, format, ids);
    } catch (error: any) {
      alert(`Export failed: ${error?.message || 'Unknown error'}`);
    }
  }

  render(): ReactNode {
    const pluginSlug = this.pluginSlug;
    const slug = this.slug;
    const theme = this.theme;
    const collection = AdminCollectionUtils.resolveCollection(this.collections, pluginSlug, slug);
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

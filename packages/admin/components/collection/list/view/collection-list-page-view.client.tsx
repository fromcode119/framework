import { ExportFormat } from '@/components/collection/list/enums/export-format.enum';
import { NotificationType } from '@/components/enums/notification-type.enum';
import type { ReactNode } from 'react';
import {Reactor, prop, ref, state, Platform} from '@fromcode119/react-class-components';
import type { Ref } from '@fromcode119/react-class-components';

import { AdminServices } from '@/lib/admin-services';
import { AdminCollectionUtils } from '@/lib/collection-utils';
import { CollectionNotFound } from '@/components/collection/view/collection-not-found.client';

import { CollectionListPageLayout } from '@/components/collection/list/view/page-layout.client';
import { CollectionListPageProps } from '@/components/collection/list/page-client-props';
import { CollectionListPageService } from '@/components/collection/list/page-service';
import { CollectionListPageLifecycle } from '@/components/collection/list/view/collection-list-page-lifecycle.client';
import { CollectionListPageViewModelBuilder } from '@/components/collection/list/view/collection-list-page-view-model.client';
import { CollectionListUtils } from '@/components/collection/list/utils';
import { RecordOperations } from '@/components/collection/list/record-operations';
import { SiteScopeGate } from '@/components/view/site-scope-gate.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { NotificationContextStore } from '@/components/view/notification-context-store.client';
import type { INotificationContextType } from '@/components/interfaces/notification-context-type.interface';
import { ArchiveOperations } from '@/components/collection/list/archive-operations';
import { CollectionListLayout } from '@/components/collection/list/collection-list-layout';
import { ListGroup } from '@/components/collection/list/list-group';
import { ListGroupSource } from '@/components/collection/list/list-group-source';
import { ListRecordChange } from '@/components/collection/list/list-record-change';

export class CollectionListPageView extends Reactor {
  static contextType = NotificationContextStore.context;
  declare context: INotificationContextType | undefined;

  @prop declare pluginSlug: string;
  @prop declare slug: string;
  @prop declare router: any;
  @prop declare pathname: string;
  @prop declare searchParams: URLSearchParams;
  @prop declare collections: any;
  @prop declare settings: any;
  @prop declare theme: any;
  @prop declare user: any;

  @state data: any[] = [];
  @state pluginSettings: Record<string, any> = {};
  /** The bound site's storefront, for each row's preview link; '' until known. See SiteStorefrontClient. */
  @state siteStorefrontUrl = '';
  @state total = 0;
  @state loading = true;
  /** Set when the list could not be loaded, so an empty table is never passed off as "no records". */
  @state loadError = '';
  @state search = '';
  @state debouncedSearch = '';
  @state page = !Platform.hasWindow
    ? 1
    : CollectionListUtils.parsePageQueryValue(new URLSearchParams(window.location.search).get('page'));
  @state sort = '-createdAt';
  @state selectedIds: string[] = [];
  @state statusFilter = 'all';
  @state fieldFilters: Record<string, string> = {};
  /** The Archived view of an archivable collection: only archived records, each with Restore. */
  @state showArchived = false;
  @state visibleColumnIds: string[] = [];
  @state stickyColumnIds: string[] = [];
  @state showColumnsMenu = false;
  @state quickEditExpandedId: string | null = null;
  @state quickEditLoadingId: string | null = null;
  @state quickEditSavingId: string | null = null;
  @state quickEditData: Record<string, any> = {};
  @state quickEditInitialData: Record<string, any> = {};
  @state quickEditStatus: { type: NotificationType; message: string } | null = null;
  @state deleteDialogState: { mode: 'single'; id: string } | { mode: 'bulk'; ids: string[] } | null = null;
  @state deleteLoading = false;
  /** The sections of a list with `admin.list.groupBy`, in their own order. */
  @state groups: ListGroup[] = [];

  /**
   * A list arranged by hand (`admin.list.groupBy` / `admin.list.order`) shows its records on one page:
   * a group split across pages, or a drag that cannot reach the record on the next page, is no
   * arrangement at all. Anything else pages by ten.
   */
  get pageSize(): number {
    const layout = CollectionListLayout.from(AdminCollectionUtils.resolveCollection(this.collections, this.pluginSlug, this.slug));
    return layout.groupField || layout.orderField ? 200 : 10;
  }

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

  /**
   * Only the newest request's answer is shown. The list fetches on mount and again as soon as its sort
   * is set from the collection's default (or the saved one); both were applied as they arrived, so a
   * slower first answer could replace the sorted one — the list showed unsorted on some loads only.
   */
  private fetchSequence = 0;

  async fetchData(targetPage?: number): Promise<void> {
    const collection = AdminCollectionUtils.resolveCollection(this.collections, this.pluginSlug, this.slug);
    const resolvedSlug = collection?.slug || this.slug;
    const page = targetPage ?? this.page;
    const sequence = ++this.fetchSequence;
    this.updateState('loading', true);
    try {
      const result = await RecordOperations.fetchCollectionData({
        resolvedSlug, targetPage: page, pageSize: this.pageSize,
        search: this.debouncedSearch, sort: this.sort,
        statusFilter: this.statusFilter, fieldFilters: this.fieldFilters, showArchived: this.showArchived
      });
      if (sequence !== this.fetchSequence) return;
      this.loadError = '';
      this.data = result.docs;
      this.total = result.totalDocs;
    } catch (error: any) {
      if (sequence !== this.fetchSequence) return;
      // Without this the table fell back to "No records found" — a positive claim that the collection
      // is empty, when in fact the request failed.
      console.error('Failed to fetch collection data:', error);
      this.loadError = error?.message || AdminI18n.t('collection.list.loadFailed');
    } finally {
      if (sequence === this.fetchSequence) this.updateState('loading', false);
    }
  }

  private groupSequence = 0;

  async loadGroups(): Promise<void> {
    const collection = AdminCollectionUtils.resolveCollection(this.collections, this.pluginSlug, this.slug);
    const layout = CollectionListLayout.from(collection);
    const sequence = ++this.groupSequence;
    if (!layout.groupField) {
      this.groups = [];
      return;
    }
    try {
      const groups = await ListGroupSource.load(collection, layout, this.collections);
      if (sequence === this.groupSequence) this.groups = groups;
    } catch (error) {
      // The records still show, under each group's id instead of its name.
      console.error('Failed to load list groups:', error);
    }
  }

  /**
   * Saves a drag: the records move at once, each change is written, and the list is read back so it
   * shows what was stored — including after a write that failed.
   */
  async handleArrange(changes: ListRecordChange[]): Promise<void> {
    const collection = AdminCollectionUtils.resolveCollection(this.collections, this.pluginSlug, this.slug);
    const resolvedSlug = collection?.slug || this.slug;
    const byId = new Map(changes.map((change) => [change.id, change.data]));
    this.data = this.data.map((row) => (byId.has(String(row.id)) ? { ...row, ...byId.get(String(row.id)) } : row));
    try {
      for (const change of changes) await RecordOperations.saveQuickEditRecord(resolvedSlug, change.id, change.data);
    } catch (error: any) {
      this.context?.notify(NotificationType.ERROR, AdminI18n.t('collection.list.reorderFailed'), error?.message || AdminI18n.t('common.unknownError'));
    }
    await this.fetchData(this.page);
  }

  /** Shows every record in its own order — the only view in which a drag says where a record goes. */
  enterArrangeMode(): void {
    const collection = AdminCollectionUtils.resolveCollection(this.collections, this.pluginSlug, this.slug);
    const layout = CollectionListLayout.from(collection);
    if (!layout.orderField) return;
    if (this.sort !== layout.orderField) this.handleSort(layout.orderField);
    this.search = '';
    this.debouncedSearch = '';
    this.statusFilter = 'all';
    this.showArchived = false;
    this.fieldFilters = Object.fromEntries(Object.keys(this.fieldFilters).map((name) => [name, 'all']));
    this.page = 1;
  }

  /** Archive or restore `ids`, then say what else the archive reached through the collection's keys. */
  async handleArchive(ids: string[], archiving: boolean): Promise<void> {
    const collection = AdminCollectionUtils.resolveCollection(this.collections, this.pluginSlug, this.slug);
    const resolvedSlug = collection?.slug || this.slug;
    if (!ids.length) return;
    this.updateState('loading', true);
    try {
      const result = await ArchiveOperations.run(resolvedSlug, ids, archiving);
      const { title, message } = ArchiveOperations.summary(result, archiving);
      this.context?.notify(NotificationType.SUCCESS, title, message);
      this.updateState('selectedIds', []);
      await this.fetchData(this.page);
    } catch (error: any) {
      const message = AdminI18n.t(archiving ? 'collection.list.archiveFailed' : 'collection.list.restoreFailed', {
        message: error?.message || AdminI18n.t('common.unknownError'),
      });
      this.context?.notify(NotificationType.ERROR, message, '');
    } finally {
      this.updateState('loading', false);
    }
  }

  async handleExport(format: ExportFormat, ids?: string[]): Promise<void> {
    const collection = AdminCollectionUtils.resolveCollection(this.collections, this.pluginSlug, this.slug);
    const resolvedSlug = collection?.slug || this.slug;
    try {
      await RecordOperations.exportRecords(resolvedSlug, format, ids);
    } catch (error: any) {
      alert(AdminI18n.t('collection.list.exportFailed', { message: error?.message || AdminI18n.t('common.unknownError') }));
    }
  }

  render(): ReactNode {
    const pluginSlug = this.pluginSlug;
    const slug = this.slug;
    const theme = this.theme;
    const collection = AdminCollectionUtils.resolveCollection(this.collections, pluginSlug, slug);
    if (!collection) return <SiteScopeGate what={`/${pluginSlug}/${slug}`}><CollectionNotFound theme={theme as any} slug={slug} pluginSlug={pluginSlug} /></SiteScopeGate>;

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

import { SiteStorefrontClient } from '@/lib/tenants/site-storefront-client';
import { AdminServices } from '@/lib/admin-services';
import { AdminCollectionUtils } from '@/lib/collection-utils';

import { CollectionListPageService } from '@/components/collection/list/page-service';
import { CollectionListUtils } from '@/components/collection/list/utils';
import type { ICollectionListPageViewProps } from '@/components/collection/list/interfaces/collection-list-page-view-props.interface';
import type { ICollectionListPageViewState } from '@/components/collection/list/interfaces/collection-list-page-view-state.interface';
import { RecordOperations } from '@/components/collection/list/record-operations';

/**
 * Imperative lifecycle/effect logic for the collection list page, extracted from the former
 * `useCollectionListPage` hook. Each method is the class-component equivalent of one useEffect, with
 * an explicit changed-guard so it is idempotent (re-running with no change is a no-op). `self` is the
 * `CollectionListPageView` instance (typed loosely to avoid a circular import) exposing `props`,
 * `state`, `updateState`, `fetchData`, `columnsMenuRef`, and the mutable `searchTimer`/`onClickOutside`.
 */
export class CollectionListPageLifecycle {
  static onMount(self: any): void {
    CollectionListPageLifecycle.redirectIfGlobal(self);
    CollectionListPageLifecycle.syncVisibleColumns(self);
    CollectionListPageLifecycle.syncStickyColumns(self);
    const sortChanges = CollectionListPageLifecycle.syncSortDefault(self);
    CollectionListPageLifecycle.syncFieldFilters(self);
    CollectionListPageLifecycle.loadPluginSettings(self);
    SiteStorefrontClient.current().then((siteStorefrontUrl) => self.setState({ siteStorefrontUrl }));
    CollectionListPageLifecycle.syncPageToUrl(self);
    // A sort about to change fetches on that change (maybeFetch); fetching now as well sent a first,
    // unsorted request whose answer could arrive last.
    if (!sortChanges) self.fetchData(self.state.page);
  }

  static onUpdate(self: any, prevProps: ICollectionListPageViewProps, prevState: ICollectionListPageViewState): void {
    const collectionContextChanged =
      prevProps.collections !== self.props.collections ||
      prevProps.pluginSlug !== self.props.pluginSlug ||
      prevProps.slug !== self.props.slug;

    if (collectionContextChanged) {
      CollectionListPageLifecycle.redirectIfGlobal(self);
      CollectionListPageLifecycle.syncVisibleColumns(self);
    CollectionListPageLifecycle.syncStickyColumns(self);
      CollectionListPageLifecycle.syncSortDefault(self);
      CollectionListPageLifecycle.syncFieldFilters(self);
      CollectionListPageLifecycle.loadPluginSettings(self);
    }

    const searchParamsChanged = prevProps.searchParams.toString() !== self.props.searchParams.toString();
    if (searchParamsChanged) CollectionListPageLifecycle.syncPageFromUrl(self);
    if (searchParamsChanged || prevState.page !== self.state.page) CollectionListPageLifecycle.syncPageToUrl(self);

    if (prevState.showColumnsMenu !== self.state.showColumnsMenu) CollectionListPageLifecycle.manageColumnsMenuListener(self);
    if (prevState.search !== self.state.search) CollectionListPageLifecycle.scheduleSearchDebounce(self);

    CollectionListPageLifecycle.maybeFetch(self, prevProps, prevState);
  }

  static onUnmount(self: any): void {
    if (self.searchTimer) clearTimeout(self.searchTimer);
    if (self.onClickOutside) document.removeEventListener('mousedown', self.onClickOutside);
  }

  private static collectionOf(self: any): any {
    return AdminCollectionUtils.resolveCollection(self.props.collections, self.props.pluginSlug, self.props.slug);
  }

  private static resolvedSlugOf(self: any): string {
    const collection = CollectionListPageLifecycle.collectionOf(self);
    return collection?.slug || self.props.slug;
  }

  private static redirectIfGlobal(self: any): void {
    const collection = CollectionListPageLifecycle.collectionOf(self);
    if (collection?.type === 'global') self.props.router.replace(`/${self.props.pluginSlug}/${self.props.slug}/settings`);
  }

  private static syncVisibleColumns(self: any): void {
    const collection = CollectionListPageLifecycle.collectionOf(self);
    const allColumns = CollectionListPageService.buildAllColumns(collection);
    if (!allColumns.length) return;
    const next = CollectionListPageService.resolveVisibleColumnIds({
      allColumns,
      adminDefaultColumns: collection?.admin?.defaultColumns,
      persistedColumns: AdminServices.getInstance().uiPreference.readCollectionColumns(self.props.pluginSlug, CollectionListPageLifecycle.resolvedSlugOf(self))
    });
    if (!CollectionListUtils.areStringArraysEqual(self.state.visibleColumnIds, next)) self.updateState('visibleColumnIds', next);
  }

  private static syncStickyColumns(self: any): void {
    const persisted = AdminServices.getInstance().uiPreference.readCollectionStickyColumns(
      self.props.pluginSlug,
      CollectionListPageLifecycle.resolvedSlugOf(self),
    );
    if (!CollectionListUtils.areStringArraysEqual(self.state.stickyColumnIds, persisted)) {
      self.updateState('stickyColumnIds', persisted);
    }
  }

  /** Sets the saved sort, else the collection's default; true when that changes the current sort. */
  private static syncSortDefault(self: any): boolean {
    const collection = CollectionListPageLifecycle.collectionOf(self);
    if (!collection) return false;
    const persisted = AdminServices.getInstance().uiPreference.readCollectionSort(self.props.pluginSlug, CollectionListPageLifecycle.resolvedSlugOf(self));
    const next = persisted || String((collection?.admin as any)?.defaultSort || '');
    if (!next || next === self.state.sort) return false;
    self.updateState('sort', next);
    return true;
  }

  private static syncFieldFilters(self: any): void {
    const collection = CollectionListPageLifecycle.collectionOf(self);
    const selectFilterFields = CollectionListPageService.resolveSelectFilterFields(collection);
    const next = selectFilterFields.length ? Object.fromEntries(selectFilterFields.map((field: any) => [field.name, 'all'])) : {};
    if (!CollectionListUtils.areStringRecordMapsEqual(self.state.fieldFilters, next)) self.updateState('fieldFilters', next);
  }

  private static loadPluginSettings(self: any): void {
    // Plugin settings are an administrators' route; for anyone else the request is refused and the
    // preview links simply go without the plugin's route prefix.
    if (!self.props.user?.roles?.includes('admin')) return;
    const collection = CollectionListPageLifecycle.collectionOf(self);
    RecordOperations.loadPluginSettings(collection?.pluginSlug)
      .then((response) => self.updateState('pluginSettings', response))
      .catch((error) => console.error('Failed to load plugin settings:', error));
  }

  private static syncPageFromUrl(self: any): void {
    const pageFromUrl = CollectionListUtils.parsePageQueryValue(self.props.searchParams.get('page'));
    if (self.state.page !== pageFromUrl) self.updateState('page', pageFromUrl);
  }

  private static syncPageToUrl(self: any): void {
    const current = self.props.searchParams.toString();
    const nextParams = new URLSearchParams(current);
    if (self.state.page <= 1) nextParams.delete('page');
    else nextParams.set('page', String(self.state.page));
    const nextQuery = nextParams.toString();
    const href = nextQuery ? `${self.props.pathname}?${nextQuery}` : self.props.pathname;
    // Remembered for this tab, so the edit screen's way back returns to this page of the list.
    AdminServices.getInstance().uiPreference.writeCollectionListHref(self.props.pluginSlug, self.props.slug, href);
    if (nextQuery !== current) self.props.router.replace(href, { scroll: false });
  }

  private static manageColumnsMenuListener(self: any): void {
    if (self.state.showColumnsMenu && !self.onClickOutside) {
      self.onClickOutside = (event: MouseEvent) => {
        if (self.columnsMenuRef.current && !self.columnsMenuRef.current.contains(event.target as Node)) self.updateState('showColumnsMenu', false);
      };
      document.addEventListener('mousedown', self.onClickOutside);
      return;
    }
    if (!self.state.showColumnsMenu && self.onClickOutside) {
      document.removeEventListener('mousedown', self.onClickOutside);
      self.onClickOutside = null;
    }
  }

  private static scheduleSearchDebounce(self: any): void {
    if (self.searchTimer) clearTimeout(self.searchTimer);
    self.searchTimer = setTimeout(() => {
      if (self.state.debouncedSearch !== self.state.search) {
        self.updateState('debouncedSearch', self.state.search);
        self.updateState('page', 1);
      }
    }, 500);
  }

  private static maybeFetch(self: any, prevProps: ICollectionListPageViewProps, prevState: ICollectionListPageViewState): void {
    const prevResolvedSlug = AdminCollectionUtils.resolveCollection(prevProps.collections, prevProps.pluginSlug, prevProps.slug)?.slug || prevProps.slug;
    const changed =
      prevState.debouncedSearch !== self.state.debouncedSearch ||
      prevState.page !== self.state.page ||
      prevState.sort !== self.state.sort ||
      prevState.statusFilter !== self.state.statusFilter ||
      prevState.showArchived !== self.state.showArchived ||
      prevResolvedSlug !== CollectionListPageLifecycle.resolvedSlugOf(self) ||
      !CollectionListUtils.areStringRecordMapsEqual(prevState.fieldFilters, self.state.fieldFilters);
    if (changed) self.fetchData(self.state.page);
  }
}

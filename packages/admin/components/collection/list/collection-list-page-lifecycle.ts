"use client";

import { AdminServices } from '@/lib/admin-services';
import { AdminCollectionUtils } from '@/lib/collection-utils';

import { CollectionListPageService } from './page-service';
import { CollectionListUtils } from './utils';
import type { CollectionListPageViewProps, CollectionListPageViewState } from './collection-list-page.interfaces';

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
    CollectionListPageLifecycle.syncSortDefault(self);
    CollectionListPageLifecycle.syncFieldFilters(self);
    CollectionListPageLifecycle.loadPluginSettings(self);
    CollectionListPageLifecycle.syncPageToUrl(self);
    self.fetchData(self.state.page);
  }

  static onUpdate(self: any, prevProps: CollectionListPageViewProps, prevState: CollectionListPageViewState): void {
    const collectionContextChanged =
      prevProps.collections !== self.props.collections ||
      prevProps.pluginSlug !== self.props.pluginSlug ||
      prevProps.slug !== self.props.slug;

    if (collectionContextChanged) {
      CollectionListPageLifecycle.redirectIfGlobal(self);
      CollectionListPageLifecycle.syncVisibleColumns(self);
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

  private static syncSortDefault(self: any): void {
    const collection = CollectionListPageLifecycle.collectionOf(self);
    if (!collection) return;
    const persisted = AdminServices.getInstance().uiPreference.readCollectionSort(self.props.pluginSlug, CollectionListPageLifecycle.resolvedSlugOf(self));
    if (persisted) { self.updateState('sort', persisted); return; }
    const defaultSort = (collection?.admin as any)?.defaultSort;
    if (defaultSort) self.updateState('sort', String(defaultSort));
  }

  private static syncFieldFilters(self: any): void {
    const collection = CollectionListPageLifecycle.collectionOf(self);
    const selectFilterFields = CollectionListPageService.resolveSelectFilterFields(collection);
    const next = selectFilterFields.length ? Object.fromEntries(selectFilterFields.map((field: any) => [field.name, 'all'])) : {};
    if (!CollectionListUtils.areStringRecordMapsEqual(self.state.fieldFilters, next)) self.updateState('fieldFilters', next);
  }

  private static loadPluginSettings(self: any): void {
    const collection = CollectionListPageLifecycle.collectionOf(self);
    CollectionListPageService.loadPluginSettings(collection?.pluginSlug)
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
    if (nextQuery !== current) self.props.router.replace(nextQuery ? `${self.props.pathname}?${nextQuery}` : self.props.pathname, { scroll: false });
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

  private static maybeFetch(self: any, prevProps: CollectionListPageViewProps, prevState: CollectionListPageViewState): void {
    const prevResolvedSlug = AdminCollectionUtils.resolveCollection(prevProps.collections, prevProps.pluginSlug, prevProps.slug)?.slug || prevProps.slug;
    const changed =
      prevState.debouncedSearch !== self.state.debouncedSearch ||
      prevState.page !== self.state.page ||
      prevState.sort !== self.state.sort ||
      prevState.statusFilter !== self.state.statusFilter ||
      prevResolvedSlug !== CollectionListPageLifecycle.resolvedSlugOf(self) ||
      !CollectionListUtils.areStringRecordMapsEqual(prevState.fieldFilters, self.state.fieldFilters);
    if (changed) self.fetchData(self.state.page);
  }
}

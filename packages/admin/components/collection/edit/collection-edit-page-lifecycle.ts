"use client";

import { StringUtils } from '@fromcode119/core/client';

import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants';
import { AdminServices } from '@/lib/admin-services';
import { AdminCollectionUtils } from '@/lib/collection-utils';

import { CollectionEditUtils } from '../collection-edit-utils';
import { CollectionEditDerivations } from './collection-edit-derivations';
import { CollectionEditPageHandlers } from './collection-edit-page-handlers';

/**
 * Effect/lifecycle logic for the collection edit page, extracted from the former
 * `useCollectionEditPage` + `useSlugGeneration` + `useSlugValidation` hooks. Each effect is guarded by
 * a signature key (stored on `self.effectKeys`) so it runs exactly when its old useEffect dependency
 * array would have changed — making re-runs idempotent and loop-free. `self` is the
 * `CollectionEditPageView` instance, typed loosely to avoid a circular import.
 */
export class CollectionEditPageLifecycle {
  static onMount(self: any): void {
    self.onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        CollectionEditPageHandlers.handleSubmit(self, new Event('submit'), self.state.changeSummary);
        self.updateState('changeSummary', '');
      }
    };
    window.addEventListener('keydown', self.onKeyDown);
    CollectionEditPageLifecycle.run(self);
  }

  static onUnmount(self: any): void {
    if (self.onKeyDown) window.removeEventListener('keydown', self.onKeyDown);
    if (self.slugValidationTimer) clearTimeout(self.slugValidationTimer);
  }

  static run(self: any): void {
    const collection = AdminCollectionUtils.resolveCollection(self.props.collections, self.props.pluginSlug, self.props.slug);
    const resolvedSlug = collection?.slug || self.props.slug;
    const isNew = self.props.id === 'new';
    const duplicateFromId = isNew ? String(self.props.searchParams.get('duplicateFrom') || '').trim() : '';

    CollectionEditPageLifecycle.ensureDataLoaded(self, { collection, resolvedSlug, isNew, duplicateFromId });
    CollectionEditPageLifecycle.guard(self, 'override', `${self.props.id}|${isNew}|${resolvedSlug}`, () =>
      self.setState({ readOnlyOverrideFields: {}, readOnlyOverridePassword: '', readOnlyOverrideTarget: null, readOnlyOverridePasswordTarget: null }));
    CollectionEditPageLifecycle.guard(self, 'pluginSettings', String(collection?.pluginSlug || ''), () => {
      if (!collection?.pluginSlug) return;
      AdminApi.get(`${AdminConstants.ENDPOINTS.PLUGINS.BASE}/${collection.pluginSlug}/settings`)
        .then((res) => self.updateState('pluginSettings', res?.settings?.settings ?? res?.settings ?? res ?? {}))
        .catch((err) => console.error('Failed to load plugin settings:', err));
    });
    CollectionEditPageLifecycle.runSlugGeneration(self, isNew);
    CollectionEditPageLifecycle.runSlugValidation(self, resolvedSlug, isNew);
  }

  private static guard(self: any, key: string, signature: string, run: () => void): void {
    if (!self.effectKeys) self.effectKeys = {};
    if (self.effectKeys[key] === signature) return;
    self.effectKeys[key] = signature;
    run();
  }

  private static ensureDataLoaded(self: any, ctx: { collection: any; resolvedSlug: string; isNew: boolean; duplicateFromId: string }): void {
    const { collection, resolvedSlug, isNew, duplicateFromId } = ctx;
    const signature = `${isNew}|${duplicateFromId}|${resolvedSlug}|${self.props.id}|${Boolean(collection)}`;
    CollectionEditPageLifecycle.guard(self, 'dataLoad', signature, () => {
      const services = AdminServices.getInstance();
      const base = AdminConstants.ENDPOINTS.COLLECTIONS.BASE;
      const token = (self.dataLoadToken = (self.dataLoadToken || 0) + 1);
      const fresh = () => token === self.dataLoadToken;

      if (!collection) { if (isNew && !duplicateFromId) self.updateState('loading', false); return; }
      if (isNew && !duplicateFromId) { self.updateState('loading', false); return; }

      self.updateState('loading', true);
      if (isNew) {
        AdminApi.get(`${base}/${resolvedSlug}/${duplicateFromId}?locale_mode=raw`)
          .then((entryData: any) => {
            if (!fresh()) return;
            self.setState({ formData: services.entityFormData.normalizeLoadedRecord(collection, CollectionEditUtils.buildDuplicateFormData(entryData, collection?.fields || [])), status: { type: 'success', message: 'Duplicate loaded. Review the values and save to create a new record.' }, loading: false });
          })
          .catch((err: any) => { if (fresh()) self.setState({ status: { type: 'error', message: err?.message || 'Failed to load duplicate source' }, loading: false }); });
        return;
      }
      AdminApi.get(`${base}/${resolvedSlug}/${self.props.id}?locale_mode=raw`)
        .then((entryData: any) => {
          if (!fresh()) return;
          self.setState({ formData: services.entityFormData.normalizeLoadedRecord(collection, entryData) });
          if (entryData.slug) self.updateState('slugManuallyEdited', true);
          CollectionEditPageHandlers.fetchRevisions(self, 1);
          self.updateState('loading', false);
        })
        .catch(() => { if (fresh()) self.setState({ status: { type: 'error', message: 'Failed to load entry' }, loading: false }); });
    });
  }

  private static runSlugGeneration(self: any, isNew: boolean): void {
    const sourceValue = CollectionEditDerivations.build(self).sourceValue || '';
    CollectionEditPageLifecycle.guard(self, 'slugSource', String(sourceValue), () => {
      if (isNew && !self.state.slugManuallyEdited && sourceValue) {
        CollectionEditPageHandlers.onSlugGenerate(self, StringUtils.slugify(sourceValue));
      }
    });
  }

  private static runSlugValidation(self: any, resolvedSlug: string, isNew: boolean): void {
    const slug = self.state.formData.slug;
    CollectionEditPageLifecycle.guard(self, 'slugValidate', `${slug}|${resolvedSlug}|${self.props.id}|${isNew}`, () => {
      if (self.slugValidationTimer) clearTimeout(self.slugValidationTimer);
      if (!slug || !resolvedSlug) { self.updateState('slugWarning', null); return; }
      self.slugValidationTimer = setTimeout(async () => {
        try {
          const query = `?slug=${encodeURIComponent(slug)}&limit=10`;
          const response = await AdminApi.get(`${AdminConstants.ENDPOINTS.COLLECTIONS.BASE}/${resolvedSlug}${query}`);
          const results = response.docs || [];
          if (Array.isArray(results) && results.length > 0) {
            const duplicate = results.find((item: any) => isNew || String(item.id) !== String(self.props.id));
            self.updateState('slugWarning', duplicate ? `This slug is already taken by "${duplicate.name || duplicate.title || duplicate.id}".` : null);
          } else {
            self.updateState('slugWarning', null);
          }
        } catch (err) {
          // Silent fail for validation helper
        }
      }, 500);
    });
  }
}

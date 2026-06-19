"use client";

import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants';
import { AdminServices } from '@/lib/admin-services';
import { AdminCollectionUtils } from '@/lib/collection-utils';
import { AdminUrlUtils } from '@/lib/url-utils';

import { CollectionEditUtils } from '../collection-edit-utils';

/**
 * Imperative handlers for the collection edit page (submit, revisions, delete, read-only override),
 * extracted from the former `useCollectionEditPage` + `useCollectionForm` hooks. `self` is the
 * `CollectionEditPageView` instance (typed loosely to avoid a circular import).
 */
export class CollectionEditPageHandlers {
  private static context(self: any): { collection: any; resolvedSlug: string; isNew: boolean } {
    const collection = AdminCollectionUtils.resolveCollection(self.props.collections, self.props.pluginSlug, self.props.slug);
    return { collection, resolvedSlug: collection?.slug || self.props.slug, isNew: self.props.id === 'new' };
  }

  static setFieldValue(self: any, name: string, value: any): void {
    self.setState((prev: any) => {
      const fieldErrors = { ...prev.fieldErrors };
      if (fieldErrors[name]) delete fieldErrors[name];
      return { formData: { ...prev.formData, [name]: value }, fieldErrors };
    });
  }

  static handleInputChange(self: any, name: string, value: any): void {
    if (self.state.formData[name] !== value) self.updateState('activeVersionId', null);
    if (name === 'slug') self.updateState('slugManuallyEdited', true);
    CollectionEditPageHandlers.setFieldValue(self, name, value);
  }

  static handlePatch(self: any, partial: Record<string, any>): void {
    for (const [name, value] of Object.entries(partial || {})) CollectionEditPageHandlers.setFieldValue(self, name, value);
  }

  static onSlugGenerate(self: any, newSlugValue: string): void {
    CollectionEditPageHandlers.setFieldValue(self, 'slug', newSlugValue);
    const fd = self.state.formData;
    if (!fd.customPermalink || fd.customPermalink === fd.slug) CollectionEditPageHandlers.setFieldValue(self, 'customPermalink', newSlugValue);
  }

  static getReadOnlyOverrideSubmitMetadata(self: any): Record<string, any> {
    const fields = Object.keys(self.state.readOnlyOverrideFields || {}).filter(Boolean);
    if (!fields.length || !self.state.readOnlyOverridePassword) return {};
    return { _readOnlyOverride: { fields, password: self.state.readOnlyOverridePassword } };
  }

  static async handleSubmit(self: any, e?: any, summary?: string): Promise<any> {
    if (e?.preventDefault) e.preventDefault();
    const { collection, resolvedSlug, isNew } = CollectionEditPageHandlers.context(self);
    self.setState({ saving: true, fieldErrors: {} });
    try {
      const base = AdminConstants.ENDPOINTS.COLLECTIONS.BASE;
      const url = isNew ? `${base}/${resolvedSlug}` : `${base}/${resolvedSlug}/${self.state.formData.id}`;
      const submitMetadata = CollectionEditPageHandlers.getReadOnlyOverrideSubmitMetadata(self);
      const payloadBase = { ...self.state.formData, ...(submitMetadata || {}) };
      const normalized = AdminServices.getInstance().entityFormData.normalizeSubmitPayload(collection, payloadBase, { isNew });
      const payload = summary ? { ...normalized, _change_summary: summary } : normalized;
      const result = await (isNew ? AdminApi.post(url, payload) : AdminApi.put(url, payload));
      self.setState({ readOnlyOverrideFields: {}, readOnlyOverridePassword: '', status: { type: 'success', message: `Entry ${isNew ? 'created' : 'updated'} successfully` } });
      if (!isNew) CollectionEditPageHandlers.fetchRevisions(self, 1);
      if (isNew) self.props.router.push(`/${self.props.pluginSlug}/${self.props.slug}/${result.id}`);
      return result;
    } catch (err: any) {
      console.error('Form submission error:', err);
      const { message, perField } = CollectionEditPageHandlers.parseSubmitError(err);
      self.setState({ fieldErrors: perField, status: { type: 'error', message } });
      throw err;
    } finally {
      self.setState({ saving: false });
    }
  }

  private static parseSubmitError(err: any): { message: string; perField: Record<string, string[]> } {
    let message = 'Operation failed';
    if (err?.data?.errors) {
      if (Array.isArray(err.data.errors)) {
        const items = err.data.errors as any[];
        message = items.map((e) => (typeof e === 'string' ? e : e.message || e.field || 'Validation error')).join(', ');
        const perField: Record<string, string[]> = {};
        for (const e of items) {
          if (e && typeof e === 'object' && e.field) {
            const key = String(e.field);
            if (!perField[key]) perField[key] = [];
            perField[key].push(typeof e.message === 'string' ? e.message : String(e.message ?? e));
          }
        }
        return { message, perField: Object.keys(perField).length ? perField : { base: [message] } };
      }
      if (typeof err.data.errors === 'object') {
        const fieldErrors = err.data.errors as Record<string, string[]>;
        return { message: Object.values(fieldErrors).flat().join(', '), perField: fieldErrors };
      }
    }
    message = err?.message || 'Operation failed';
    return { message, perField: { base: [message] } };
  }

  static async fetchRevisions(self: any, page: number): Promise<void> {
    const { resolvedSlug } = CollectionEditPageHandlers.context(self);
    self.setState({ revisionsLoading: true });
    try {
      const result = await AdminApi.get(`${AdminConstants.ENDPOINTS.VERSIONS.BASE}/${resolvedSlug}/${self.props.id}?limit=20&page=${page}`);
      const mapped = (result.docs || []).map((v: any) => ({
        id: v.id, version: v.version || 1, date: new Date(v.created_at || v.createdAt),
        user: v.updated_by || v.updatedBy || 'System', action: v.change_summary || 'Update',
        changes: CollectionEditUtils.reviveSerializedRevisionValue(v.version_data || {})
      }));
      self.setState((prev: any) => ({ revisions: page === 1 ? mapped : [...prev.revisions, ...mapped], hasMoreRevisions: result.hasNextPage || (result.docs?.length === 10) }));
    } catch (err) {
      console.error('Failed to fetch revisions:', err);
    } finally {
      self.setState({ revisionsLoading: false });
    }
  }

  static loadMoreRevisions(self: any): void {
    const next = self.state.revisionPage + 1;
    self.updateState('revisionPage', next);
    CollectionEditPageHandlers.fetchRevisions(self, next);
  }

  static async handleHardRestore(self: any, version: number): Promise<void> {
    const { collection, resolvedSlug } = CollectionEditPageHandlers.context(self);
    if (!confirm(`Are you sure you want to PERMANENTLY restore the live record to version ${version}? This will update the database immediately.`)) return;
    self.setState({ restoringPermanently: true });
    try {
      const response = await AdminApi.post(AdminConstants.ENDPOINTS.VERSIONS.RESTORE(resolvedSlug, self.props.id, version), {});
      self.setState({ formData: AdminServices.getInstance().entityFormData.normalizeLoadedRecord(collection, response.data), status: { type: 'success', message: `Record permanently restored to version ${version}` }, selectedRevision: null });
      CollectionEditPageHandlers.fetchRevisions(self, 1);
    } catch (err: any) {
      console.error('Hard restore failed:', err);
      self.setState({ status: { type: 'error', message: err.message || 'Failed to restore record' } });
    } finally {
      self.setState({ restoringPermanently: false });
    }
  }

  static getPreviewUrl(self: any): string {
    const { collection } = CollectionEditPageHandlers.context(self);
    if (!collection) return '#';
    return AdminCollectionUtils.generatePreviewUrl(
      AdminUrlUtils.resolveFrontendBaseUrl(self.props.settings, self.props.settings?.frontend_url),
      self.state.formData, collection, self.props.settings?.permalink_structure, self.state.pluginSettings
    );
  }

  static async handleDelete(self: any): Promise<void> {
    const { resolvedSlug } = CollectionEditPageHandlers.context(self);
    self.setState({ deleting: true });
    try {
      await AdminApi.delete(`${AdminConstants.ENDPOINTS.COLLECTIONS.BASE}/${resolvedSlug}/${self.props.id}`);
      self.props.router.push(`/${self.props.pluginSlug}/${self.props.slug}`);
    } catch (err: any) {
      self.setState({ status: { type: 'error', message: err.message }, deleting: false, showDeleteConfirm: false });
    }
  }

  static handleReadOnlyOverrideRequest(self: any, target: { name: string; label: string }): void {
    self.updateState('readOnlyOverrideTarget', target);
  }

  static openReadOnlyOverridePasswordPrompt(self: any): void {
    if (!self.state.readOnlyOverrideTarget) return;
    self.setState({ readOnlyOverridePasswordTarget: self.state.readOnlyOverrideTarget, readOnlyOverrideTarget: null });
  }

  static async handleReadOnlyOverridePasswordConfirm(self: any, password: string): Promise<void> {
    const target = self.state.readOnlyOverridePasswordTarget;
    if (!target) return;
    const { resolvedSlug, isNew } = CollectionEditPageHandlers.context(self);
    self.setState({ readOnlyOverrideVerifying: true });
    try {
      await AdminApi.post(AdminConstants.ENDPOINTS.AUTH.VERIFY_PASSWORD, { password, purpose: 'read_only_override', collectionSlug: resolvedSlug, field: target.name, recordId: isNew ? null : self.props.id });
      self.setState((prev: any) => ({ readOnlyOverridePassword: password, readOnlyOverrideFields: { ...prev.readOnlyOverrideFields, [target.name]: true }, status: { type: 'success', message: `${target.label} unlocked for manual override.` }, readOnlyOverridePasswordTarget: null }));
    } catch (err: any) {
      self.setState({ status: { type: 'error', message: err?.message || 'Password verification failed' } });
    } finally {
      self.setState({ readOnlyOverrideVerifying: false });
    }
  }
}

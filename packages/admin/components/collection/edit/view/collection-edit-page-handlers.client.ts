import { NotificationType } from '@/components/enums/notification-type.enum';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { AdminServices } from '@/lib/admin-services';
import { AdminCollectionUtils } from '@/lib/collection-utils';
import { AdminUrlUtils } from '@/lib/url-utils';
import { CollectionEditUtils } from '@/components/collection/collection-edit-utils';

/**
 * Imperative handlers for the collection edit page (submit, revisions, delete, read-only override),
 * extracted from the former `useCollectionEditPage` + `useCollectionForm` hooks. `self` is the
 * `CollectionEditPageView` instance (typed loosely to avoid a circular import).
 */
export class CollectionEditPageHandlers {
  /** Version History page size. Sent as `limit`, and `offset` is derived from it. */
  private static readonly REVISIONS_PAGE_SIZE = 20;

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
      // What was just persisted becomes the new pristine baseline, so the save bar goes quiet until the
      // operator edits again instead of insisting there is still unsaved work.
      self.setState({ readOnlyOverrideFields: {}, readOnlyOverridePassword: '', pristineFormData: { ...self.state.formData }, status: { type: NotificationType.SUCCESS, message: `Entry ${isNew ? 'created' : 'updated'} successfully` } });
      if (!isNew) CollectionEditPageHandlers.fetchRevisions(self, 1);
      if (isNew) self.props.router.push(`/${self.props.pluginSlug}/${self.props.slug}/${result.id}`);
      return result;
    } catch (err: any) {
      console.error('Form submission error:', err);
      const { message, perField } = CollectionEditPageHandlers.parseSubmitError(err);
      self.setState({ fieldErrors: perField, status: { type: NotificationType.ERROR, message } });
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

  /**
   * One page of Version History.
   *
   * Three separate defects lived in the old version of this method:
   *  1. it sent `page=`, which `rest-read-controller.getVersions` IGNORES (it reads only
   *     `limit`/`offset`), so "load more" would have re-appended page 1;
   *  2. `hasNextPage` is never returned by `versioning-service.getVersions`, and the fallback
   *     compared `docs.length === 10` against a `limit=20` request — never true — so the
   *     "Load More History" button NEVER rendered and history was silently capped at 20 revisions;
   *  3. a revision with no recorded author was attributed to "System" and one with no summary was
   *     labelled "Update" — invented entries in an AUDIT TRAIL.
   *
   * The versions endpoint serves rows straight off the raw DB manager, so the payload is snake_case
   * only; the camelCase halves of the old `v.created_at || v.createdAt` reads were dead code.
   */
  static async fetchRevisions(self: any, page: number): Promise<void> {
    const { resolvedSlug } = CollectionEditPageHandlers.context(self);
    const limit = CollectionEditPageHandlers.REVISIONS_PAGE_SIZE;
    const offset = (Math.max(1, page) - 1) * limit;
    self.setState({ revisionsLoading: true });
    try {
      const result = await AdminApi.get(`${AdminConstants.ENDPOINTS.VERSIONS.BASE}/${resolvedSlug}/${self.props.id}?limit=${limit}&offset=${offset}`);
      const docs = result.docs || [];
      const mapped = docs.map((v: any) => ({
        id: v.id, version: v.version || 1, date: new Date(v.created_at),
        user: v.updated_by || '-', action: v.change_summary || '-',
        changes: CollectionEditUtils.reviveSerializedRevisionValue(v.version_data || {})
      }));
      self.setState((prev: any) => {
        const revisions = page === 1 ? mapped : [...prev.revisions, ...mapped];
        const total = Number(result.totalDocs);
        return {
          revisions,
          hasMoreRevisions: Number.isFinite(total) ? revisions.length < total : docs.length === limit,
        };
      });
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
      self.setState({ formData: AdminServices.getInstance().entityFormData.normalizeLoadedRecord(collection, response.data), status: { type: NotificationType.SUCCESS, message: `Record permanently restored to version ${version}` }, selectedRevision: null });
      CollectionEditPageHandlers.fetchRevisions(self, 1);
    } catch (err: any) {
      console.error('Hard restore failed:', err);
      self.setState({ status: { type: NotificationType.ERROR, message: err.message || 'Failed to restore record' } });
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
      self.setState({ status: { type: NotificationType.ERROR, message: err.message }, deleting: false, showDeleteConfirm: false });
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
      self.setState((prev: any) => ({ readOnlyOverridePassword: password, readOnlyOverrideFields: { ...prev.readOnlyOverrideFields, [target.name]: true }, status: { type: NotificationType.SUCCESS, message: `${target.label} unlocked for manual override.` }, readOnlyOverridePasswordTarget: null }));
    } catch (err: any) {
      self.setState({ status: { type: NotificationType.ERROR, message: err?.message || 'Password verification failed' } });
    } finally {
      self.setState({ readOnlyOverrideVerifying: false });
    }
  }
}

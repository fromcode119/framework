import { beforeEach, describe, expect, it, vi } from 'vitest';

const put = vi.fn();
const post = vi.fn();
const get = vi.fn();

vi.mock('@/lib/api', () => ({ AdminApi: { put: (...a: unknown[]) => put(...a), post: (...a: unknown[]) => post(...a), get: (...a: unknown[]) => get(...a) } }));
vi.mock('@/lib/admin-services', () => ({
  AdminServices: { getInstance: () => ({ entityFormData: { normalizeSubmitPayload: (_c: unknown, payload: unknown) => payload } }) },
}));
vi.mock('@/lib/collection-utils', () => ({
  AdminCollectionUtils: { resolveCollection: () => ({ slug: 'cms_pages', fields: [] }) },
}));

import { CollectionEditPageHandlers } from '@/components/collection/edit/view/collection-edit-page-handlers.client';

/** Minimal stand-in for `CollectionEditPageView` — records what setState wrote. */
class EditPageStub {
  state: Record<string, any> = { formData: { id: 7, title: 'Original' }, pristineFormData: { id: 7, title: 'Original' } };
  props = { collections: [], pluginSlug: 'cms', slug: 'cms_pages', id: '7', router: { push: vi.fn() } };

  setState(patch: any): void {
    Object.assign(this.state, typeof patch === 'function' ? patch(this.state) : patch);
  }

  updateState(key: string, value: any): void {
    this.state[key] = value;
  }
}

describe('handleSubmit — the saved record becomes the new pristine baseline', () => {
  beforeEach(() => {
    put.mockReset().mockResolvedValue({ id: 7 });
    post.mockReset();
    get.mockReset().mockResolvedValue({ docs: [] });
  });

  it('a saved edit is no longer reported as unsaved', async () => {
    const self = new EditPageStub();
    // The operator edits the title; the snapshot still holds the loaded value.
    self.state.formData = { id: 7, title: 'Edited' };

    await CollectionEditPageHandlers.handleSubmit(self as any, undefined, 'summary');

    // Without this the save bar kept insisting there were unsaved changes after a successful save,
    // because the snapshot still held the pre-save values.
    expect(self.state.pristineFormData).toEqual({ id: 7, title: 'Edited' });
    expect(put).toHaveBeenCalledTimes(1);
  });

  it('the snapshot is a COPY — later edits must not mutate it into agreeing with the form', async () => {
    const self = new EditPageStub();
    self.state.formData = { id: 7, title: 'Edited' };

    await CollectionEditPageHandlers.handleSubmit(self as any, undefined, undefined);
    self.state.formData.title = 'Edited again';

    expect(self.state.pristineFormData).toEqual({ id: 7, title: 'Edited' });
  });

  it('a FAILED save leaves the snapshot alone — the changes are still unsaved', async () => {
    const self = new EditPageStub();
    self.state.formData = { id: 7, title: 'Edited' };
    put.mockRejectedValue(new Error('boom'));

    await expect(CollectionEditPageHandlers.handleSubmit(self as any, undefined, undefined)).rejects.toThrow('boom');

    expect(self.state.pristineFormData).toEqual({ id: 7, title: 'Original' });
  });
});

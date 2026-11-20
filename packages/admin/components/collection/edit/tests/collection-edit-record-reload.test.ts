import { vi } from 'vitest';

const saved = { id: 3, stock: 6, stockStatus: 'instock', name: 'Tee', sku: 'V3T' };

vi.mock('@/components/collection/edit/view/collection-edit-page-handlers.client', () => ({
  CollectionEditPageHandlers: {
    context: () => ({ collection: {}, resolvedSlug: 'products', isNew: false }),
    reloadSaved: vi.fn(async () => ({ ...saved })),
  },
}));

import { CollectionEditRecordReload } from '@/components/collection/edit/view/collection-edit-record-reload.client';

/** A page whose `setState` applies updaters and calls back the way React does. */
class FakePage {
  props = {};
  state: Record<string, any>;
  constructor(formData: Record<string, any>, pristine: Record<string, any>) {
    this.state = { formData, pristineFormData: pristine, recordReads: 0 };
  }
  setState(update: any, done?: () => void): void {
    this.state = { ...this.state, ...(typeof update === 'function' ? update(this.state) : update) };
    done?.();
  }
}

/** A field's own action saved the stock; the page reads the record again without losing what is typed. */
describe('CollectionEditRecordReload.reload', () => {
  it('takes the saved values the operator has not edited, and keeps the ones being edited', async () => {
    const pristine = { id: 3, stock: 5, stockStatus: 'instock', name: 'Tee', sku: 'V3T' };
    const page = new FakePage({ ...pristine, name: 'Tee (typed)' }, pristine);
    const changed = await CollectionEditRecordReload.reload(page);
    expect(changed).toEqual({ stock: 6 });
    expect(page.state.formData.stock).toBe(6);
    expect(page.state.formData.name).toBe('Tee (typed)');
    // The new baseline is the saved record, so the typed name is still an unsaved change and the stock is not.
    expect(page.state.pristineFormData).toEqual(saved);
    expect(page.state.recordReads).toBe(1);
  });

  it('reads nothing for a record that is not saved yet', async () => {
    const page = new FakePage({ name: 'New' }, null as any);
    expect(await CollectionEditRecordReload.reload(page)).toEqual({});
    expect(page.state.recordReads).toBe(0);
  });
});

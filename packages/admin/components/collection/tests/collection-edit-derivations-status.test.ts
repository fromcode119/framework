import { describe, it, expect } from 'vitest';
import { CollectionEditDerivations } from '@/components/collection/edit/view/collection-edit-derivations.client';

/**
 * The header status select was built from any `status` select and ignored its `readOnly`, offering a
 * change the server then refused ("Unlock confirmation is required to change read-only fields").
 */
const selfFor = (statusAdmin: Record<string, unknown>, collectionAdmin: Record<string, unknown> = {}) => ({
  props: {
    collections: [{
      slug: 'records',
      pluginSlug: 'demo',
      displayName: 'Records',
      admin: { useAsTitle: 'title', ...collectionAdmin },
      fields: [
        { name: 'title', type: 'text', label: 'Title' },
        { name: 'status', type: 'select', label: 'Status', options: [{ label: 'Open', value: 'open' }, { label: 'Done', value: 'done' }], admin: statusAdmin },
      ],
    }],
    pluginSlug: 'demo', slug: 'records', id: '3', settings: {},
  },
  state: { formData: { status: 'open' }, pristineFormData: {}, activeTab: 'general', selectedRevision: null, revisions: [] },
});

describe('CollectionEditDerivations — header status', () => {
  it('offers the options of an editable status', () => {
    expect(CollectionEditDerivations.build(selfFor({})).statusOptions.map((o: any) => o.value)).toEqual(['open', 'done']);
  });

  it('offers none for a read-only status', () => {
    expect(CollectionEditDerivations.build(selfFor({ readOnly: true })).statusOptions).toEqual([]);
  });

  it('offers none on a locked record', () => {
    expect(CollectionEditDerivations.build(selfFor({}, { disableEdit: true })).statusOptions).toEqual([]);
  });
});

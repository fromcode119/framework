import { describe, it, expect } from 'vitest';
import { CollectionEditDerivations } from '@/components/collection/edit/view/collection-edit-derivations.client';

/**
 * `admin.disableEdit` was declared by eleven collections and read by nothing — the edit form saved
 * happily. These lock every field instead, so the declaration is true and the row is still visible.
 */
const collectionWith = (admin: Record<string, unknown>) => ({
  slug: 'journal',
  pluginSlug: 'demo',
  displayName: 'Journal',
  admin: { useAsTitle: 'title', ...admin },
  fields: [
    { name: 'title', type: 'text', label: 'Title' },
    { name: 'note', type: 'text', label: 'Note', admin: { position: 'sidebar' } },
  ],
});

const selfFor = (admin: Record<string, unknown>, id: string) => ({
  props: { collections: [collectionWith(admin)], pluginSlug: 'demo', slug: 'journal', id, settings: {} },
  state: { formData: {}, pristineFormData: {}, activeTab: 'general', selectedRevision: null, revisions: [] },
});

const fieldsOf = (d: any) => [
  ...d.standardMainFieldSections.flatMap((s: any) => s.fields),
  ...d.fullWidthMainFieldSections.flatMap((s: any) => s.fields),
  ...d.sidebarFieldSections.flatMap((s: any) => s.fields),
];

describe('CollectionEditDerivations — disableEdit lock', () => {
  it('marks every field read-only when editing a row of a disableEdit collection', () => {
    const d = CollectionEditDerivations.build(selfFor({ disableEdit: true }, '7'));
    expect(d.locked).toBe(true);
    expect(fieldsOf(d).map((f: any) => f.admin?.readOnly)).toEqual([true, true]);
  });

  it('leaves fields editable on a collection that does not declare it', () => {
    const d = CollectionEditDerivations.build(selfFor({}, '7'));
    expect(d.locked).toBe(false);
    expect(fieldsOf(d).some((f: any) => f.admin?.readOnly)).toBe(false);
  });

  it('does not lock the create form — disableCreate refuses it outright instead', () => {
    const d = CollectionEditDerivations.build(selfFor({ disableEdit: true }, 'new'));
    expect(d.locked).toBe(false);
  });
});

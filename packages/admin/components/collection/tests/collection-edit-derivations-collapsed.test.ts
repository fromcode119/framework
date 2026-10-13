import { describe, it, expect } from 'vitest';
import { CollectionEditDerivations } from '@/components/collection/edit/view/collection-edit-derivations.client';

/**
 * `admin.sectionCollapsed` starts a section closed on the edit form, for values an operator rarely
 * reads but must be able to open (what the runtime computed from the record). The section and every
 * field in it must still be delivered to the page — collapsing is not hiding.
 */
const selfFor = (fields: any[]) => ({
  props: { collections: [{ slug: 'items', pluginSlug: 'demo', displayName: 'Items', admin: { useAsTitle: 'name' }, fields }], pluginSlug: 'demo', slug: 'items', id: '3', settings: {} },
  state: { formData: {}, pristineFormData: {}, activeTab: 'general', selectedRevision: null, revisions: [] },
});

const section = (d: any, title: string) => d.standardMainFieldSections.find((s: any) => s.title === title);

describe('CollectionEditDerivations — sectionCollapsed', () => {
  const name = { name: 'name', type: 'text', label: 'Name', admin: { section: 'Product' } };
  const computedA = { name: 'cardPrice', type: 'number', label: 'Card price', admin: { section: 'Computed', sectionCollapsed: true } };
  const computedB = { name: 'cardStock', type: 'number', label: 'Card stock', admin: { section: 'Computed' } };

  it('marks a section collapsed when any of its fields declares it', () => {
    const d = CollectionEditDerivations.build(selfFor([name, computedB, computedA]));
    expect(section(d, 'Computed').collapsed).toBe(true);
  });

  it('still delivers every field of a collapsed section, so it opens with nothing missing', () => {
    const d = CollectionEditDerivations.build(selfFor([name, computedA, computedB]));
    expect(section(d, 'Computed').fields.map((f: any) => f.name)).toEqual(['cardPrice', 'cardStock']);
  });

  it('leaves other sections open', () => {
    const d = CollectionEditDerivations.build(selfFor([name, computedA, computedB]));
    expect(section(d, 'Product').collapsed).toBe(false);
  });

  it('never collapses the untitled section: there would be no title left to open it by', () => {
    const loose = { name: 'note', type: 'text', label: 'Note', admin: { sectionCollapsed: true } };
    const d = CollectionEditDerivations.build(selfFor([loose]));
    expect(d.standardMainFieldSections[0].collapsed).toBe(false);
  });
});

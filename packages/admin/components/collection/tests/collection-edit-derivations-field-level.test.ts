import { describe, it, expect } from 'vitest';
import { CollectionEditDerivations } from '@/components/collection/edit/view/collection-edit-derivations.client';

/**
 * `admin.level` says how often an operator needs a field. The form opens on the everyday ones and
 * widens on request; a field the save depends on is drawn at every depth, so widening is never the
 * only way to find out why a record will not save.
 */
const selfFor = (fields: any[], state: Record<string, unknown> = {}) => ({
  props: { collections: [{ slug: 'items', pluginSlug: 'demo', displayName: 'Items', admin: { useAsTitle: 'name' }, fields }], pluginSlug: 'demo', slug: 'items', id: '3', settings: {} },
  state: { formData: { name: 'Lamp' }, pristineFormData: {}, activeTab: 'general', selectedRevision: null, revisions: [], fieldErrors: {}, ...state },
});

const names = (d: any) => [...d.standardMainFieldSections, ...d.sidebarFieldSections].flatMap((s: any) => s.fields.map((f: any) => f.name));

describe('CollectionEditDerivations — field level', () => {
  const name = { name: 'name', type: 'text', label: 'Name' };
  const cost = { name: 'cost', type: 'number', label: 'Cost', admin: { level: 'occasional' } };
  const key = { name: 'replayKey', type: 'text', label: 'Replay key', admin: { level: 'technical', position: 'sidebar' } };

  it('opens on the everyday fields when no depth was chosen', () => {
    expect(names(CollectionEditDerivations.build(selfFor([name, cost, key])))).toEqual(['name']);
  });

  it('adds the occasional fields at that depth and the technical ones only at the widest', () => {
    expect(names(CollectionEditDerivations.build(selfFor([name, cost, key], { fieldDepth: 'occasional' })))).toEqual(['name', 'cost']);
    expect(names(CollectionEditDerivations.build(selfFor([name, cost, key], { fieldDepth: 'technical' })))).toEqual(['name', 'cost', 'replayKey']);
  });

  it('counts every level before narrowing, so the switch can say what each depth adds', () => {
    const d = CollectionEditDerivations.build(selfFor([name, cost, key]));
    expect(d.fieldLevelCounts).toEqual({ everyday: 1, occasional: 1, technical: 1 });
  });

  it('treats an undeclared level as everyday, so an untagged collection reads as before', () => {
    const d = CollectionEditDerivations.build(selfFor([name, { name: 'note', type: 'text', label: 'Note' }]));
    expect(names(d)).toEqual(['name', 'note']);
    expect(d.fieldLevelCounts).toEqual({ everyday: 2, occasional: 0, technical: 0 });
  });

  it('draws a field carrying an error at every depth', () => {
    const d = CollectionEditDerivations.build(selfFor([name, cost], { fieldErrors: { cost: ['Must be a number'] } }));
    expect(names(d)).toEqual(['name', 'cost']);
  });

  it('draws a required field that is still empty at every depth, and withdraws it once filled', () => {
    const required = { ...cost, required: true };
    expect(names(CollectionEditDerivations.build(selfFor([name, required])))).toEqual(['name', 'cost']);
    expect(names(CollectionEditDerivations.build(selfFor([name, required], { formData: { name: 'Lamp', cost: 4 } })))).toEqual(['name']);
  });

  it('drops a section left with no field at the chosen depth', () => {
    const d = CollectionEditDerivations.build(selfFor([name, { ...cost, admin: { level: 'occasional', section: 'Costs' } }]));
    expect(d.standardMainFieldSections.map((s: any) => s.title)).toEqual([undefined]);
  });

  it('keeps a section where its fields put it, even when the field that set its layout is held back', () => {
    const wide = { name: 'address', type: 'json', label: 'Address', admin: { section: 'Payment', sectionLayout: 'full', level: 'occasional' } };
    const method = { name: 'method', type: 'text', label: 'Method', admin: { section: 'Payment' } };
    const d = CollectionEditDerivations.build(selfFor([name, wide, method]));
    expect(d.fullWidthMainFieldSections.map((s: any) => s.title)).toEqual(['Payment']);
    expect(d.fullWidthMainFieldSections[0].fields.map((f: any) => f.name)).toEqual(['method']);
  });
});

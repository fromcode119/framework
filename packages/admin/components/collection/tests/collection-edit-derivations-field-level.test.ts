import { describe, it, expect } from 'vitest';
import { CollectionEditDerivations } from '@/components/collection/edit/view/collection-edit-derivations.client';

/**
 * `admin.level` says how often an operator needs a field. A record draws its everyday fields; every section
 * holding more is one "More" row, opening that section in place (`?section=<key>,…`) with all of it.
 * A field the save depends on is drawn on the record whatever its level.
 */
const selfFor = (fields: any[], state: Record<string, unknown> = {}, query = '') => ({
  props: { collections: [{ slug: 'items', pluginSlug: 'demo', displayName: 'Items', admin: { useAsTitle: 'name' }, fields }], pluginSlug: 'demo', slug: 'items', id: '3', settings: {}, searchParams: new URLSearchParams(query) },
  state: { formData: { name: 'Lamp' }, pristineFormData: {}, activeTab: 'general', selectedRevision: null, revisions: [], fieldErrors: {}, ...state },
});

const names = (d: any) => [...d.standardMainFieldSections, ...d.sidebarFieldSections].flatMap((s: any) => s.fields.map((f: any) => f.name));

describe('CollectionEditDerivations — what a record draws and lists under More', () => {
  const name = { name: 'name', type: 'text', label: 'Name' };
  const cost = { name: 'cost', type: 'number', label: 'Cost', admin: { level: 'occasional' } };
  const key = { name: 'replayKey', type: 'text', label: 'Replay key', admin: { level: 'technical', position: 'sidebar' } };

  it('draws the everyday fields on the record', () => {
    expect(names(CollectionEditDerivations.build(selfFor([name, cost, key])))).toEqual(['name']);
  });

  it('lists each section holding more as one row, with how many fields it adds', () => {
    const d = CollectionEditDerivations.build(selfFor([name, { ...cost, admin: { level: 'occasional', section: 'Costs' } }, key]));
    expect(d.moreSections.map((row: any) => [row.title, row.count])).toEqual([[expect.any(String), 1], ['Costs', 1]]);
    expect(d.openedSections).toEqual([]);
  });

  it('opens a section in place: the record stays whole and the section gains every field of it', () => {
    const costs = { ...cost, admin: { level: 'occasional', section: 'Costs' } };
    const listed = CollectionEditDerivations.build(selfFor([name, costs, key])).moreSections;
    const costsKey = listed.find((row: any) => row.title === 'Costs').key;
    const d = CollectionEditDerivations.build(selfFor([name, costs, key], {}, `section=${costsKey}`));
    expect(names(d)).toEqual(['name', 'cost']);
    expect(d.openedSections).toEqual([costsKey]);
    expect(d.moreSections.map((row: any) => row.key)).not.toContain(costsKey);
    expect(d.moreSections).toHaveLength(1);
  });

  it('keeps several sections open, named in the address', () => {
    const costs = { ...cost, admin: { level: 'occasional', section: 'Costs' } };
    const keys = CollectionEditDerivations.build(selfFor([name, costs, key])).moreSections.map((row: any) => row.key);
    const d = CollectionEditDerivations.build(selfFor([name, costs, key], {}, `section=${keys.join(',')}`));
    expect(names(d).sort()).toEqual(['cost', 'name', 'replayKey']);
    expect(d.moreSections).toEqual([]);
  });

  it('shows the record as it is when a link names no section', () => {
    const d = CollectionEditDerivations.build(selfFor([name, cost], {}, 'section=gone'));
    expect(names(d)).toEqual(['name']);
  });

  it('treats an undeclared level as everyday, so an untagged collection lists nothing more', () => {
    const d = CollectionEditDerivations.build(selfFor([name, { name: 'note', type: 'text', label: 'Note' }]));
    expect(names(d)).toEqual(['name', 'note']);
    expect(d.moreSections).toEqual([]);
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

  it('drops a section left with no everyday field', () => {
    const d = CollectionEditDerivations.build(selfFor([name, { ...cost, admin: { level: 'occasional', section: 'Costs' } }]));
    expect(d.standardMainFieldSections.map((s: any) => s.title)).toEqual([undefined]);
  });

  it('keeps a section where its fields put it, even when the field that set its layout is held back', () => {
    const wide = { name: 'address', type: 'json', label: 'Address', admin: { section: 'Payment', sectionLayout: 'full', level: 'occasional' } };
    const method = { name: 'method', type: 'text', label: 'Method', admin: { section: 'Payment' } };
    const d = CollectionEditDerivations.build(selfFor([name, wide, method]));
    expect(d.standardMainFieldSections.map((s: any) => s.title)).toEqual([undefined, 'Payment']);
    expect(d.standardMainFieldSections[1].fields.map((f: any) => f.name)).toEqual(['method']);
  });

  it('keeps the main sections in the order the collection declares them, wide ones included', () => {
    const items = { name: 'items', type: 'json', label: 'Items', admin: { section: 'Summary', sectionLayout: 'full' } };
    const method = { name: 'method', type: 'text', label: 'Method', admin: { section: 'Payment' } };
    const d = CollectionEditDerivations.build(selfFor([items, method]));
    expect(d.standardMainFieldSections.map((s: any) => s.title)).toEqual(['Summary', 'Payment']);
    expect(d.fullWidthMainFieldSections).toEqual([]);
  });
});

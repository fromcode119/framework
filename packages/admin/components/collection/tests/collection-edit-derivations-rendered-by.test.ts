import { describe, it, expect } from 'vitest';
import { CollectionEditDerivations } from '@/components/collection/edit/view/collection-edit-derivations.client';

/**
 * `admin.renderedBy` removes a field from the standard renderer because a SIBLING field's component
 * draws its control — an order's five amounts edited as one summary, a date range edited as one
 * picker.
 *
 * It is one line away from `admin.hidden`, and the difference is the whole point: hidden asserts
 * there is no control, which Rule Zero forbids, while `renderedBy` names the control's owner. The
 * filtering therefore has to be exact. Too eager and a field the operator needs silently disappears
 * from every collection that uses it; too lax and the value renders twice, once in the summary and
 * once as a stray input beside it.
 *
 * It was verified by hand on one order screen. This pins it for every collection.
 */
const collection = (fields: any[]) => ({
  slug: 'ledger',
  pluginSlug: 'demo',
  displayName: 'Ledger',
  admin: { useAsTitle: 'title' },
  fields,
});

const selfFor = (fields: any[], id = '7') => ({
  props: { collections: [collection(fields)], pluginSlug: 'demo', slug: 'ledger', id, settings: {} },
  state: { formData: {}, pristineFormData: {}, activeTab: 'general', selectedRevision: null, revisions: [] },
});

const renderedNames = (d: any) => [
  ...d.standardMainFieldSections.flatMap((s: any) => s.fields),
  ...d.fullWidthMainFieldSections.flatMap((s: any) => s.fields),
  ...d.sidebarFieldSections.flatMap((s: any) => s.fields),
].map((f: any) => f.name);

describe('CollectionEditDerivations — renderedBy', () => {
  const host = { name: 'subtotal', type: 'number', label: 'Subtotal', admin: { component: 'TotalsField' } };
  const owned = { name: 'tax', type: 'number', label: 'Tax', admin: { renderedBy: 'subtotal' } };
  const ordinary = { name: 'title', type: 'text', label: 'Title' };

  it('drops a field whose control a sibling renders', () => {
    const names = renderedNames(CollectionEditDerivations.build(selfFor([ordinary, host, owned])));
    expect(names).not.toContain('tax');
  });

  it('keeps the HOST that renders it — dropping that would erase the control itself', () => {
    const names = renderedNames(CollectionEditDerivations.build(selfFor([ordinary, host, owned])));
    expect(names).toContain('subtotal');
  });

  it('leaves every other field untouched', () => {
    const names = renderedNames(CollectionEditDerivations.build(selfFor([ordinary, host, owned])));
    expect(names).toContain('title');
  });

  it('is inert on a collection that declares none — the filter must not cost other screens a field', () => {
    const plain = [ordinary, { name: 'amount', type: 'number', label: 'Amount' }];
    expect(renderedNames(CollectionEditDerivations.build(selfFor(plain))).sort()).toEqual(['amount', 'title']);
  });

  it('drops a SIDEBAR field too — the sidebar is a second renderer, not an exemption', () => {
    const sidebarOwned = { name: 'fee', type: 'number', label: 'Fee', admin: { position: 'sidebar', renderedBy: 'subtotal' } };
    const names = renderedNames(CollectionEditDerivations.build(selfFor([ordinary, host, sidebarOwned])));
    expect(names).not.toContain('fee');
  });

  it('keeps an ordinary sidebar field', () => {
    const sidebarPlain = { name: 'note', type: 'text', label: 'Note', admin: { position: 'sidebar' } };
    const names = renderedNames(CollectionEditDerivations.build(selfFor([ordinary, host, sidebarPlain])));
    expect(names).toContain('note');
  });

  /** An empty string is not a declaration — it must not silently erase the field. */
  it('ignores an empty renderedBy rather than treating it as owned', () => {
    const blank = { name: 'amount', type: 'number', label: 'Amount', admin: { renderedBy: '' } };
    expect(renderedNames(CollectionEditDerivations.build(selfFor([ordinary, blank])))).toContain('amount');
  });

  it('applies on the CREATE form as well, where the same summary renders the same fields', () => {
    const names = renderedNames(CollectionEditDerivations.build(selfFor([ordinary, host, owned], 'new')));
    expect(names).not.toContain('tax');
    expect(names).toContain('subtotal');
  });

  it('still drops a hidden field, which renderedBy must not accidentally rescue', () => {
    const hiddenField = { name: 'secret', type: 'text', label: 'Secret', admin: { hidden: true } };
    expect(renderedNames(CollectionEditDerivations.build(selfFor([ordinary, hiddenField])))).not.toContain('secret');
  });
});

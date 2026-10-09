import { describe, expect, it } from 'vitest';
import { CollectionListLayout } from '@/components/collection/list/collection-list-layout';
import { QuickEditControl } from '@/components/collection/list/quick-edit-control';

const products = (list?: unknown) => ({
  slug: 'products',
  admin: { useAsTitle: 'name', defaultColumns: ['images', 'name', 'sku', 'price', 'stock', 'status'], list },
  fields: [
    { name: 'name', type: 'text', label: 'Name', localized: true },
    { name: 'images', type: 'relationship', relationTo: 'media', hasMany: true },
    { name: 'sku', type: 'text', label: 'SKU' },
    { name: 'price', type: 'number', label: 'Price' },
    { name: 'stock', type: 'number', label: 'Stock', admin: { readOnly: true } },
    { name: 'status', type: 'select', options: [{ label: 'Draft', value: 'draft' }, { label: 'Published', value: 'published' }] },
    { name: 'tags', type: 'relationship', relationTo: 'tags', hasMany: true },
    { name: 'summary', type: 'text', label: 'Summary' },
    { name: 'notes', type: 'textarea' },
    { name: 'specs', type: 'json' },
    { name: 'secret', type: 'text', admin: { hidden: true } },
  ],
});

describe('CollectionListLayout.from — what the list reads when nothing is declared', () => {
  const layout = CollectionListLayout.from(products());

  it('takes the title from useAsTitle, the badge from the status select, the thumbnail from the first media column', () => {
    expect(layout.titleField).toBe('name');
    expect(layout.badgeField).toBe('status');
    expect(layout.mediaField).toBe('images');
  });

  it('fills the meta line from the first default columns that are not the frame', () => {
    expect(layout.metaFields).toEqual(['sku', 'price']);
    expect(layout.trailingField).toBe('');
  });

  it('edits nothing in place, and offers every simple editable field in the row form', () => {
    expect(layout.inlineFields).toEqual([]);
    expect(layout.rowFields.map((entry) => entry.name)).toEqual(['name', 'sku', 'price', 'status', 'tags', 'summary']);
  });
});

describe('CollectionListLayout.from — a declared admin.list', () => {
  it('uses exactly what is declared, in the declared order and widths', () => {
    const layout = CollectionListLayout.from(products({
      badge: 'status', meta: ['sku', 'stock'], trailing: 'price',
      quickEdit: { inline: ['price', 'status'], row: [{ field: 'name', span: 2 }, { field: 'price' }, { field: 'summary', control: 'textarea', span: 4 }] },
    }));
    expect(layout.metaFields).toEqual(['sku', 'stock']);
    expect(layout.trailingField).toBe('price');
    expect(layout.inlineFields).toEqual(['price', 'status']);
    expect(layout.rowFields.map((entry) => [entry.name, entry.span])).toEqual([['name', 2], ['price', 1], ['summary', 4]]);
    expect(layout.rowFields[2].field.type).toBe('textarea');
    expect(layout.refused).toEqual([]);
  });

  it('labels the numbers on the meta line, and only those', () => {
    const layout = CollectionListLayout.from(products({ meta: ['sku', 'stock'] }));
    expect(layout.metaLabels).toEqual({ stock: 'Stock' });
  });

  it('refuses — and says why — what cannot be edited from the list', () => {
    const layout = CollectionListLayout.from(products({
      quickEdit: { inline: ['stock', 'secret', 'ghost'], row: [{ field: 'specs' }, { field: 'images' }, { field: 'tags', control: 'relation' }, { field: 'price', control: 'toggle' }, { field: 'sku' }] },
    }));
    expect(layout.inlineFields).toEqual([]);
    expect(layout.rowFields.map((entry) => entry.name)).toEqual(['sku']);
    expect(layout.refused).toEqual([
      'quickEdit.inline "stock" is read-only',
      'quickEdit.inline "secret" is hidden',
      'quickEdit.inline "ghost" is not a field of this collection',
      'quickEdit.row "specs" is a json field, which only the full editor can change',
      'quickEdit.row "images" is a media field, which only the full editor can change',
      'quickEdit.row "tags" holds several values, so it needs the tags control',
      'quickEdit.row "price" is a number field and cannot use the toggle control',
    ]);
  });

  it('refuses a role naming a field the collection does not have, instead of showing an empty slot', () => {
    const layout = CollectionListLayout.from(products({ badge: 'state', trailing: 'total' }));
    expect(layout.badgeField).toBe('status');
    expect(layout.trailingField).toBe('');
    expect(layout.refused).toEqual(['badge "state" is not a field of this collection', 'trailing "total" is not a field of this collection']);
  });
});

describe('QuickEditControl.apply', () => {
  it('keeps a localized field localized when it is drawn as a textarea', () => {
    const field = { name: 'name', type: 'text', admin: { component: 'LocalizedText' } };
    expect(QuickEditControl.apply(field, 'textarea')).toMatchObject({ type: 'textarea', admin: { component: 'LocalizedTextarea' } });
  });

  it('leaves the field as it is when the control is its own', () => {
    const field = { name: 'price', type: 'number' };
    expect(QuickEditControl.apply(field, 'number')).toBe(field);
    expect(QuickEditControl.apply(field)).toBe(field);
  });
});

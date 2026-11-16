import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StructuredReadOnlyField } from '@/components/collection/fields/view/structured-read-only-field.client';

import { MediaRelationPreviewResolver } from '@/components/collection/media-relation-preview-resolver';

const variants = [
  { key: 'S', sku: 'TS-S', options: { 'Размер': 'S' }, isDefault: true, isPopular: false, image: '/uploads/s.webp' },
  { key: 'M', sku: 'TS-M', options: { 'Размер': 'M' }, isDefault: false, isPopular: true, image: '/uploads/m.webp' },
];

describe('A read-only table, arranged from its own values', () => {
  it('finds the picture column by its values, draws it first, and leaves out columns no row fills', () => {
    const rows = [
      { key: 'S', sku: 'TS-S', gtin: '', image: '/uploads/s.webp', isPopular: false },
      { key: 'M', sku: 'TS-M', gtin: '', image: null, isPopular: false },
    ];
    render(<StructuredReadOnlyField value={rows} field={{ name: 'variants', admin: { keyLabels: { key: 'Вариант', image: 'Снимка' } } }} />);
    const headings = screen.getAllByRole('columnheader').map((cell) => cell.textContent?.trim());
    expect(headings).toEqual(['Снимка', 'Вариант', 'Sku']);
    expect([...document.querySelectorAll('img.fc-sro-table__thumb')].map((image) => image.getAttribute('src'))).toEqual(['/uploads/s.webp']);
    expect(document.querySelectorAll('.fc-sro-table__thumb--none').length).toBe(1);
  });
});

describe('A column of objects, read down', () => {
  const two = [
    { key: 'S / Бяло', options: { 'Размер': 'S', 'Цвят': 'Бяло' } },
    { key: 'M / Черно', options: { 'Размер': 'M', 'Цвят': 'Черно' } },
  ];

  it('becomes a column per axis, so the table is read down and not value by value', () => {
    render(<StructuredReadOnlyField value={two} field={{ name: 'variants', admin: { keyLabels: { key: 'Вариант' } } }} />);
    const headings = screen.getAllByRole('columnheader').map((cell) => cell.textContent?.trim());
    expect(headings).toEqual(['Вариант', 'Размер', 'Цвят']);
    expect(screen.queryByText('Размер: S · Цвят: Бяло')).toBeNull();
  });

  it('stays whole when an axis would collide with a column already there', () => {
    const clashing = [{ 'Размер': 'голям', options: { 'Размер': 'S' } }];
    render(<StructuredReadOnlyField value={clashing} field={{ name: 'variants' }} />);
    const headings = screen.getAllByRole('columnheader').map((cell) => cell.textContent?.trim());
    expect(headings).toEqual(['Размер', 'Options']);
  });
});

describe('A structured table with a declared layout', () => {
  it('keeps missing media and zero quantities while expanding option columns in the requested order', () => {
    render(<StructuredReadOnlyField
      value={[{ key: 'S|White', options: { Size: 'S', Color: 'White' }, sku: 'SHIRT-S-WHITE', stock: 0, enabled: true }]}
      field={{ admin: {
        keyLabels: { key: 'Title', sku: 'SKU', stock: 'Inventory' },
        tableLayout: [
          { key: 'image', media: true },
          { key: 'key', join: { from: 'options', separator: ' / ' } },
          { key: 'sku' },
          { key: 'options' },
          { key: 'stock' },
        ],
      } }}
    />);
    expect(screen.getAllByRole('columnheader').map((cell) => cell.textContent?.trim()))
      .toEqual(['Image', 'Title', 'SKU', 'Size', 'Color', 'Inventory']);
    expect(screen.getByText('S / White')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByTitle('No picture')).toBeInTheDocument();
    expect(screen.queryByText('Enabled')).toBeNull();
  });

  it('resolves a stored media ID to a thumbnail', async () => {
    const resolve = vi.spyOn(MediaRelationPreviewResolver, 'resolve')
      .mockResolvedValue({ id: '123', url: '/uploads/photo.webp', filename: 'photo.webp', mimeType: 'image/webp' });
    try {
      const { container } = render(<StructuredReadOnlyField value={[{ image: 123 }]}
        field={{ admin: { tableLayout: [{ key: 'image', media: true }] } }} />);
      await screen.findByAltText('');
      expect(resolve).toHaveBeenCalledWith('123');
      expect(container.querySelector('img')).toHaveAttribute('src', '/uploads/photo.webp');
    } finally {
      resolve.mockRestore();
    }
  });
});

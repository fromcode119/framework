import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StructuredReadOnlyField } from '@/components/collection/fields/view/structured-read-only-field.client';

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

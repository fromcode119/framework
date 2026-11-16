import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StructuredReadOnlyField } from '@/components/collection/fields/view/structured-read-only-field.client';

const variants = [
  { key: 'S', sku: 'TS-S', options: { 'Размер': 'S' }, isDefault: true, isPopular: false, image: '/uploads/s.webp' },
  { key: 'M', sku: 'TS-M', options: { 'Размер': 'M' }, isDefault: false, isPopular: true, image: '/uploads/m.webp' },
];

describe('A read-only table, told which columns to draw', () => {
  it('draws the declared columns in the declared order and leaves the rest to the editor', () => {
    render(<StructuredReadOnlyField
      value={variants}
      field={{ name: 'variants', admin: { tableColumns: ['image', 'key', 'sku', 'options'], keyLabels: { key: 'Вариант', sku: 'Артикулен номер', options: 'Опции', image: 'Изображение' } } }}
    />);
    const headings = screen.getAllByRole('columnheader').map((cell) => cell.textContent?.trim());
    expect(headings).toEqual(['Изображение', 'Вариант', 'Артикулен номер', 'Размер']);
    expect(screen.queryByText('Is Default')).toBeNull();
    expect(screen.queryByText('Is Popular')).toBeNull();
  });

  it('splits an options column into a column per axis, each value a chip', () => {
    render(<StructuredReadOnlyField value={variants} field={{ name: 'variants', admin: { tableColumns: ['key', 'options'] } }} />);
    const chips = document.querySelectorAll('.fc-chip');
    expect([...chips].map((chip) => chip.textContent)).toEqual(['S', 'M']);
    expect(chips[0].getAttribute('title')).toBe('Размер: S');
    expect(screen.queryByText('Размер: S')).toBeNull();
    expect(screen.getAllByRole('columnheader').map((cell) => cell.textContent?.trim())).toContain('Размер');
  });

  it('draws a picture as the picture alone, with no column of addresses beside it', () => {
    render(<StructuredReadOnlyField value={variants} field={{ name: 'variants', admin: { tableColumns: ['image', 'key'] } }} />);
    const images = document.querySelectorAll('img.fc-sro-table__thumb');
    expect([...images].map((image) => image.getAttribute('src'))).toEqual(['/uploads/s.webp', '/uploads/m.webp']);
    expect(document.querySelectorAll('.fc-sro-table a').length).toBe(0);
  });

  it('ignores a declaration that names nothing the rows hold, rather than drawing an empty table', () => {
    render(<StructuredReadOnlyField value={variants} field={{ name: 'variants', admin: { tableColumns: ['nothingLikeThis'] } }} />);
    const headings = screen.getAllByRole('columnheader').map((cell) => cell.textContent?.trim());
    expect(headings).toContain('Key');
    expect(headings.length).toBeGreaterThan(1);
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

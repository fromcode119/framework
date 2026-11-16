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
    expect(headings).toEqual(['Изображение', 'Вариант', 'Артикулен номер', 'Опции']);
    expect(screen.queryByText('Is Default')).toBeNull();
    expect(screen.queryByText('Is Popular')).toBeNull();
  });

  it('draws a folded object as one chip per value, not as a line of key: value', () => {
    render(<StructuredReadOnlyField value={variants} field={{ name: 'variants', admin: { tableColumns: ['key', 'options'] } }} />);
    const chips = document.querySelectorAll('.fc-chip');
    expect([...chips].map((chip) => chip.textContent)).toEqual(['S', 'M']);
    expect(chips[0].getAttribute('title')).toBe('Размер: S');
    expect(screen.queryByText('Размер: S')).toBeNull();
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

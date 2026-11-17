import { describe, expect, it } from 'vitest';
import { RecordSectionRepeatedLabel } from '@/components/collection/edit/record-section-repeated-label';

/**
 * A field named after the section it stands in loses its own label: the create form drew
 * "Изображения" as the section's title and then "Изображения" again over the control.
 */
describe('RecordSectionRepeatedLabel', () => {
  const section = (title: string | undefined, count = 1) =>
    ({ title, fields: Array.from({ length: count }, () => ({})) }) as any;

  it('hides the label when it repeats the section title', () => {
    const field = RecordSectionRepeatedLabel.apply({ name: 'images', label: 'Изображения' }, section('Изображения'));
    expect(field.admin.hideLabel).toBe(true);
  });

  it('hides it in a section that holds several fields too', () => {
    const field = RecordSectionRepeatedLabel.apply({ name: 'images', label: 'Изображения' }, section('Изображения', 3));
    expect(field.admin.hideLabel).toBe(true);
  });

  it('ignores a difference in case or trailing space, which is the same word to a reader', () => {
    const field = RecordSectionRepeatedLabel.apply({ name: 'images', label: ' изображения ' }, section('Изображения'));
    expect(field.admin.hideLabel).toBe(true);
  });

  it('keeps a label that says something the title does not', () => {
    const field = RecordSectionRepeatedLabel.apply({ name: 'alt', label: 'Алтернативен текст' }, section('Изображения'));
    expect(field.admin?.hideLabel).toBeUndefined();
  });

  it('keeps every other admin setting the field declares', () => {
    const field = RecordSectionRepeatedLabel.apply(
      { name: 'images', label: 'Изображения', admin: { description: 'Първото е основното' } },
      section('Изображения'),
    );
    expect(field.admin.description).toBe('Първото е основното');
    expect(field.admin.hideLabel).toBe(true);
  });

  it('leaves a field alone in a section with no title of its own', () => {
    const field = RecordSectionRepeatedLabel.apply({ name: 'images', label: 'Изображения' }, section(undefined));
    expect(field.admin?.hideLabel).toBeUndefined();
  });
});

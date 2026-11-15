import { RecordSectionFields } from '@/components/collection/edit/record-section-fields';

/**
 * Which fields a saved record's card shows as values and which keep a component of their own. The rule
 * decides where about a hundred plugin fields are drawn, so it is asserted rather than assumed.
 */
describe('RecordSectionFields.ownsItsControl', () => {
  const field = (type: string, admin: Record<string, unknown>) => ({ name: 'x', type, admin });

  it('is false for a plain value carrying a component — the card reads it, the sheet changes it', () => {
    expect(RecordSectionFields.ownsItsControl(field('text', { component: 'FinanceCurrencyField' }))).toBe(false);
    expect(RecordSectionFields.sheetFields([field('text', { component: 'FinanceCurrencyField' })])).toHaveLength(1);
  });

  it('is true only where the component is the ONLY way to read the value', () => {
    expect(RecordSectionFields.ownsItsControl(field('relationship', { component: 'TagField' }))).toBe(true);
    expect(RecordSectionFields.ownsItsControl(field('media', { component: 'Gallery' }))).toBe(true);
  });

  it('is false for DATA — the record reads it, the sheet changes it', () => {
    const variants = field('json', { component: 'VariantsField' });
    expect(RecordSectionFields.ownsItsControl(variants)).toBe(false);
    expect(RecordSectionFields.readsAsData(variants)).toBe(true);
    // It is edited in the sheet, and it is not ALSO listed as a plain row on the card.
    expect(RecordSectionFields.sheetFields([variants])).toHaveLength(1);
    expect(RecordSectionFields.shownFields([variants], { x: [{ a: 1 }] })).toHaveLength(0);
  });

  it('leaves data alone when the field says how it reads or that it is used in place', () => {
    expect(RecordSectionFields.readsAsData(field('json', { component: 'Tags', readComponent: 'TagsRead' }))).toBe(false);
    expect(RecordSectionFields.readsAsData(field('json', { component: 'Tags', inPlace: true }))).toBe(false);
  });

  it('is true for a plain value whose component must be used in place', () => {
    expect(RecordSectionFields.ownsItsControl(field('textarea', { component: 'HtmlEditor', inPlace: true }))).toBe(true);
  });

  it('is false when the field declares how it reads', () => {
    expect(RecordSectionFields.ownsItsControl(field('json', { component: 'Tags', readAsValue: true }))).toBe(false);
    expect(RecordSectionFields.ownsItsControl(field('json', { component: 'Tags', readComponent: 'TagsRead' }))).toBe(false);
  });

  it('is false without a component at all', () => {
    expect(RecordSectionFields.ownsItsControl(field('text', {}))).toBe(false);
  });
});

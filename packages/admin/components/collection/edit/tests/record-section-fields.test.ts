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

  it('is true for a value with a shape — its component IS how the value reads', () => {
    expect(RecordSectionFields.ownsItsControl(field('json', { component: 'Tags' }))).toBe(true);
    expect(RecordSectionFields.ownsItsControl(field('relationship', { component: 'TagField' }))).toBe(true);
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

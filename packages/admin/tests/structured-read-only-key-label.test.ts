import { describe, expect, it } from 'vitest';
import { StructuredReadOnlyFieldService } from '@/components/collection/fields/structured-read-only-field-service';

describe('StructuredReadOnlyFieldService.keyLabel', () => {
  it('reads a data key the way a person says it', () => {
    expect(StructuredReadOnlyFieldService.keyLabel('changedBy')).toBe('Changed By');
    expect(StructuredReadOnlyFieldService.keyLabel('taxRatePercent')).toBe('Tax Rate Percent');
    expect(StructuredReadOnlyFieldService.keyLabel('shipping_charged_separately')).toBe('Shipping Charged Separately');
  });

  it('keeps GENERIC data acronyms as acronyms', () => {
    expect(StructuredReadOnlyFieldService.keyLabel('cityId')).toBe('City ID');
    expect(StructuredReadOnlyFieldService.keyLabel('labelUrl')).toBe('Label URL');
  });

  it('holds no business vocabulary of its own', () => {
    // COD, VAT, IBAN, SKU, AWB are commerce, finance and logistics words. They were in this list,
    // inside packages/admin, which is supposed to contain no business domain at all.
    expect(StructuredReadOnlyFieldService.keyLabel('codAmount')).toBe('Cod Amount');
    expect(StructuredReadOnlyFieldService.keyLabel('vatNumber')).toBe('Vat Number');
    expect(StructuredReadOnlyFieldService.keyLabel('skuCode')).toBe('Sku Code');
  });

  it('lets the owning plugin name its own keys', () => {
    const labels = { codAmount: 'COD amount', taxRatePercent: 'Tax rate %' };

    expect(StructuredReadOnlyFieldService.keyLabel('codAmount', labels)).toBe('COD amount');
    expect(StructuredReadOnlyFieldService.keyLabel('taxRatePercent', labels)).toBe('Tax rate %');
    // Anything the plugin does not name falls back to the generic title-case.
    expect(StructuredReadOnlyFieldService.keyLabel('fullName', labels)).toBe('Full Name');
    // A blank override is not a label.
    expect(StructuredReadOnlyFieldService.keyLabel('fullName', { fullName: '   ' })).toBe('Full Name');
  });

  it('only replaces WHOLE words, so ordinary words survive', () => {
    // The substring trap: `Idempotency` starts with "id" and `avoid` ends with one.
    expect(StructuredReadOnlyFieldService.keyLabel('idempotencyKey')).toBe('Idempotency Key');
    expect(StructuredReadOnlyFieldService.keyLabel('avoid')).toBe('Avoid');
    expect(StructuredReadOnlyFieldService.keyLabel('videoUrl')).toBe('Video URL');
  });

  it('leaves an array index alone rather than title-casing it into a word', () => {
    expect(StructuredReadOnlyFieldService.keyLabel('[0]')).toBe('[0]');
    expect(StructuredReadOnlyFieldService.keyLabel('[12]')).toBe('[12]');
  });

  it('answers empty for an empty key instead of throwing', () => {
    expect(StructuredReadOnlyFieldService.keyLabel('')).toBe('');
    expect(StructuredReadOnlyFieldService.keyLabel('   ')).toBe('');
    expect(StructuredReadOnlyFieldService.keyLabel(undefined as unknown as string)).toBe('');
  });
});

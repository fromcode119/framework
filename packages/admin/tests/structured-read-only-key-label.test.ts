import { describe, expect, it } from 'vitest';
import { StructuredReadOnlyFieldService } from '@/components/collection/fields/structured-read-only-field-service';

describe('StructuredReadOnlyFieldService.keyLabel', () => {
  it('reads a data key the way a person says it', () => {
    expect(StructuredReadOnlyFieldService.keyLabel('changedBy')).toBe('Changed By');
    expect(StructuredReadOnlyFieldService.keyLabel('taxRatePercent')).toBe('Tax Rate Percent');
    expect(StructuredReadOnlyFieldService.keyLabel('shipping_charged_separately')).toBe('Shipping Charged Separately');
  });

  it('keeps acronyms as acronyms', () => {
    // Title-casing turned these into words: "Cod Amount" reads as a fish, and "City Id" is not what
    // the operator calls it.
    expect(StructuredReadOnlyFieldService.keyLabel('codAmount')).toBe('COD Amount');
    expect(StructuredReadOnlyFieldService.keyLabel('cityId')).toBe('City ID');
    expect(StructuredReadOnlyFieldService.keyLabel('labelUrl')).toBe('Label URL');
    expect(StructuredReadOnlyFieldService.keyLabel('customerVatId')).toBe('Customer VAT ID');
  });

  it('only replaces WHOLE words, so ordinary words survive', () => {
    // The substring trap: `Idempotency` starts with "id" and `avoid` ends with one.
    expect(StructuredReadOnlyFieldService.keyLabel('idempotencyKey')).toBe('Idempotency Key');
    expect(StructuredReadOnlyFieldService.keyLabel('avoid')).toBe('Avoid');
    expect(StructuredReadOnlyFieldService.keyLabel('videoUrl')).toBe('Video URL');
    expect(StructuredReadOnlyFieldService.keyLabel('codec')).toBe('Codec');
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

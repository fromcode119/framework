import { describe, expect, it } from 'vitest';
import { RelationshipIdSpellings } from '@api/services/relationship-id-spellings';

/**
 * Searching a list by a RELATED record's name matches the relationship column against the ids that
 * were found. That column is jsonb, and Postgres REFUSES `CAST(jsonb AS REAL)` on a string with
 * "cannot cast jsonb string to type real" — the CMS pages list answered with that error instead of
 * records. The ids are therefore compared as text, in every spelling they can be stored in.
 */
describe('relationship search ids', () => {
  it('covers the number, the trailing-zero form and the quoted jsonb forms', () => {
    const spellings = RelationshipIdSpellings.of([5]);
    expect(spellings).toEqual(expect.arrayContaining(['5', '5.0', '"5"', '"5.0"']));
  });

  it('keeps a non-numeric id as itself, quoted and unquoted, and invents no number for it', () => {
    const spellings = RelationshipIdSpellings.of(['abc']);
    expect(spellings).toEqual(expect.arrayContaining(['abc', '"abc"']));
    expect(spellings.some((value) => /^\d/.test(value))).toBe(false);
  });

  it('does not collapse two different ids into one', () => {
    const spellings = RelationshipIdSpellings.of([5, 7]);
    expect(spellings).toEqual(expect.arrayContaining(['5', '7']));
    expect(spellings).not.toContain('6');
  });
});

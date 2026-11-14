/**
 * Every spelling one related id can have inside a jsonb relationship column.
 *
 * Searching a list by a RELATED record's name matches that column against the ids that were found.
 * The column is jsonb and the id inside it may be written as a number (5), as a string ("5") or as
 * a float-ish string ("5.0"), so no single comparison catches them all. The list used to cast the
 * column to a number for numeric ids, and Postgres does not merely miss on a jsonb string — it
 * REFUSES the cast with "cannot cast jsonb string to type real", so the whole list answered with
 * that error instead of records. Comparing the column as text against these spellings has no cast
 * to refuse. The quoted forms are there because `CAST(jsonb AS TEXT)` keeps a string's own quotes.
 */
export class RelationshipIdSpellings {
  static of(ids: unknown[]): string[] {
    const out = new Set<string>();
    for (const id of ids) {
      const raw = String(id);
      out.add(raw);
      const asNumber = Number(raw);
      if (raw.trim() !== '' && Number.isFinite(asNumber)) {
        out.add(String(asNumber));
        if (Number.isInteger(asNumber)) out.add(`${asNumber}.0`);
      }
    }
    for (const value of [...out]) out.add(`"${value}"`);
    return [...out];
  }
}

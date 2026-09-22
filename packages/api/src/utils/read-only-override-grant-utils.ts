/**
 * The scope of a read-only override grant — composed in ONE place because the endpoint that mints it
 * and the guard that verifies it must agree exactly. `verifyGrantToken` compares the scope string
 * verbatim, so two hand-built strings that drift by a separator would either refuse every valid grant
 * or, worse, widen what one password entry authorizes.
 *
 * The grant is per RECORD, not per field: unlocking one read-only field on a record unlocks the rest
 * of that record's overrideable fields. A field declared `readOnlyOverride: 'never'` is NOT reachable
 * this way — that check lives in the guard and is not what the grant speaks to.
 */
export class ReadOnlyOverrideGrantUtils {
  static readonly PURPOSE = 'read_only_override';

  /** A record that does not exist yet has no scope — read-only fields may be SET freely on create. */
  static scope(collectionSlug: string, recordId: string | number | null | undefined): string {
    const slug = String(collectionSlug || '').trim();
    const id = recordId === null || recordId === undefined ? '' : String(recordId).trim();
    return `collection:${slug}:record:${id}`;
  }
}

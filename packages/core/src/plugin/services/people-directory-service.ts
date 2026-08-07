/**
 * Framework-owned ingestion of plugin domain rows into the shared `people` directory.
 *
 * WHY THIS EXISTS IN THE FRAMEWORK
 * Seven plugins (finance, ecommerce, mlm, lms, numerology, subscriptions, astrology) each shipped a
 * byte-similar `*PeopleBackfillService` with the same match -> fill-empty merge -> upsert block and the
 * same whole-table scan. Per the "cross-cutting work belongs to the framework" rule that logic lives
 * here ONCE; a plugin now supplies only the part that is genuinely its own — how one of ITS rows maps
 * to a person identity.
 *
 * WHY THERE IS NO `person_id` COLUMN ANY MORE
 * The old services also wrote a `person_id` back onto the plugin table and used it as the
 * "already processed" marker. Nothing ever read that column (see audit-2026-08-06 A1), it could not be
 * surfaced in the admin (`people` is not a registered collection), and it was an un-invalidated cache of
 * a match that the framework can always recompute. The marker is now a CURSOR in `_system_meta`, so the
 * sync reads only rows added since the last run instead of the whole table on every boot.
 */
export class PeopleDirectoryService {
  /** `_system_meta` key prefix for the per-table ingestion cursor. */
  private static readonly CURSOR_PREFIX = 'people.directory.cursor';

  /** Rows pulled per sync pass. A cursor advance means the next boot resumes where this one stopped. */
  private static readonly DEFAULT_BATCH = 500;

  constructor(
    private readonly pluginSlug: string,
    private readonly pluginDb: { find: (table: string, options: Record<string, any>) => Promise<any> },
    private readonly meta: { get: (key: string) => Promise<string | null>; set: (key: string, value: unknown) => Promise<void> },
    private readonly match: (input: { userId?: any; email?: string; phone?: string }) => Promise<Record<string, any> | null>,
    private readonly upsert: (input: Record<string, any>) => Promise<Record<string, any> | null>,
  ) {}

  /**
   * Fill-empty merge: an existing non-empty value on the person always wins, missing values are filled
   * from the incoming plugin row. This is what stops a boot sync from overwriting an operator's edits.
   */
  static mergeFillEmpty(existing: Record<string, any> | null, incoming: Record<string, any>): Record<string, any> {
    const merged: Record<string, any> = { ...incoming };
    for (const key of Object.keys(incoming)) {
      const current = existing?.[key];
      const currentText = current == null ? '' : String(current).trim();
      if (currentText !== '') merged[key] = current;
    }
    return merged;
  }

  /**
   * A blank `userId` must never reach `people.user_id` — it is an INTEGER FK to `users.id`, so `''`
   * would throw "FOREIGN KEY constraint failed". Absent means omitted, not blanked.
   */
  static withCleanUserId(payload: Record<string, any>): Record<string, any> {
    const out = { ...payload };
    if (out.userId == null || String(out.userId).trim() === '') delete out.userId;
    return out;
  }

  /** Does this payload carry an identifier `match` can dedupe on? */
  static hasAnchor(input: Record<string, any>): boolean {
    const email = input?.email == null ? '' : String(input.email).trim();
    const userId = input?.userId == null ? '' : String(input.userId).trim();
    const phone = input?.phone == null ? '' : String(input.phone).trim();
    return email !== '' || userId !== '' || phone !== '';
  }

  /**
   * Is there enough here to be a person at all? An anchor (email/userId/phone) dedupes; a bare name
   * still describes a real person — that is how a relative's profile, deliberately stripped of the
   * enrolling account's shared email, enters the directory as someone distinct.
   */
  static isIngestable(input: Record<string, any>): boolean {
    if (PeopleDirectoryService.hasAnchor(input)) return true;
    const displayName = input?.displayName == null ? '' : String(input.displayName).trim();
    return displayName !== '';
  }

  /**
   * Resolve (or create) the person for one identity payload and return them.
   * Returns `null` when the payload describes nobody.
   */
  async ingest(input: Record<string, any>): Promise<Record<string, any> | null> {
    if (!PeopleDirectoryService.isIngestable(input)) return null;
    const existing = PeopleDirectoryService.hasAnchor(input)
      ? await this.match({ userId: input.userId, email: input.email, phone: input.phone })
      : null;
    const payload = existing
      ? PeopleDirectoryService.mergeFillEmpty(existing, input)
      : input;
    const saved = await this.upsert(PeopleDirectoryService.withCleanUserId(payload));
    return saved ?? existing ?? null;
  }

  /**
   * Ingest every row of `table` added since the last run.
   *
   * `id` is the monotonic autoincrement PK, so `id > cursor` is exactly "new rows" — this is O(new rows),
   * never a whole-table scan. `map` turns one row into an identity payload; a payload describing nobody
   * (no email/userId/phone AND no name) skips that row — the cursor still advances, because a row that
   * carries no identity cannot acquire one without being edited, and edits are the operator's business.
   */
  async sync(
    table: string,
    map: (row: Record<string, any>) => Record<string, any> | Promise<Record<string, any>>,
    batch: number = PeopleDirectoryService.DEFAULT_BATCH,
  ): Promise<number> {
    const key = `${PeopleDirectoryService.CURSOR_PREFIX}.${this.pluginSlug}.${table}`;
    const parsedCursor = Number(await this.meta.get(key));
    const cursor = Number.isFinite(parsedCursor) ? parsedCursor : 0;

    const found = await this.pluginDb.find(table, {
      where: { id: { gt: cursor } },
      orderBy: { id: 'asc' },
      limit: batch,
    });
    const rows: Array<Record<string, any>> = Array.isArray(found) ? found : Array.isArray(found?.docs) ? found.docs : [];
    if (rows.length === 0) return 0;

    let ingested = 0;
    let highest = cursor;
    for (const row of rows) {
      const rowId = Number(row?.id);
      if (Number.isFinite(rowId) && rowId > highest) highest = rowId;
      if (await this.ingest(await map(row))) ingested++;
    }

    if (highest > cursor) await this.meta.set(key, highest);
    return ingested;
  }
}

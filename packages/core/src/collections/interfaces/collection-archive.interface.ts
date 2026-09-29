/**
 * Declares a collection ARCHIVABLE: its records can be put out of sight and brought back, instead of
 * being deleted.
 *
 * `archive: {}` is enough on its own — a CMS page, a test product, a stale form. The framework then
 * gives the collection an `archivedAt` and an `archivedWith` field, leaves archived rows out of every
 * list and count, and the admin list grows an Archived view with Archive / Restore actions.
 *
 * Records in DIFFERENT plugins that belong together are archived together through correlation keys —
 * shared vocabulary like `orderNumber`, the same names `admin.recordLinks.keys` uses. Each map is
 * `KEY NAME → the field on THIS record carrying it`:
 *
 * - `leads`   — archiving one of these records takes along every record that FOLLOWS the same key
 *               with the same value (an order leads `orderNumber`).
 * - `follows` — this collection is taken along when a record leading that key is archived, and
 *               brought back when that record is restored (an invoice follows `orderNumber`).
 *
 * Neither side names the other. A follower archived by a leader records the leader in `archivedWith`,
 * which is how restoring the leader restores exactly what it archived, and nothing archived separately.
 */
export interface ICollectionArchive {
  leads?: Record<string, string>;
  follows?: Record<string, string>;
}

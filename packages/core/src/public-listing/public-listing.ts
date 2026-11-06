import { Enum } from '@fromcode119/react-class-components/lang';
import { PublicListingSurface } from '@core/public-listing/enums/public-listing-surface.enum';

/**
 * Where a PUBLISHED record is listed — the second level after "is it public at all". Every value keeps the
 * record's own page open at its link; they differ only in which lists name it:
 *
 * - Public: catalogue, search and sitemap.
 * - Catalog only: catalogue and sitemap, not search.
 * - Search only: search, not the catalogue (and so not the sitemap, which mirrors the catalogue's pages).
 * - Hidden: no list at all — reachable only by its link.
 *
 * The operator sets it in the record's `visibility` field ({@link PublicListing.field}); every list,
 * search provider and sitemap asks {@link PublicListing.shownIn}, so one rule decides it everywhere.
 * A record stored before the field existed has no value and is Public, the field's own default.
 * An unrecognised value lists nowhere (fail closed), but its page still opens.
 */
export class PublicListing extends Enum {
  static readonly FIELD = 'visibility';

  static readonly PUBLIC = new PublicListing('public', 'Catalog and search', [PublicListingSurface.CATALOG, PublicListingSurface.SEARCH, PublicListingSurface.SITEMAP]);
  static readonly CATALOG_ONLY = new PublicListing('catalog_only', 'Catalog only', [PublicListingSurface.CATALOG, PublicListingSurface.SITEMAP]);
  static readonly SEARCH_ONLY = new PublicListing('search_only', 'Search only', [PublicListingSurface.SEARCH]);
  static readonly HIDDEN = new PublicListing('hidden', 'Nowhere (its link only)', []);

  private constructor(value: string, readonly label: string, private readonly surfaces: PublicListingSurface[]) {
    super(value);
  }

  /** Whether this value lists a record on that surface. */
  lists(surface: PublicListingSurface): boolean {
    return this.surfaces.includes(surface);
  }

  /** A stored value as a member: empty is Public (the field's default), anything unrecognised is Hidden. */
  static resolve(value: unknown): PublicListing {
    const key = String(value ?? '').trim();
    if (!key) return PublicListing.PUBLIC;
    return PublicListing.fromValue(key) ?? PublicListing.HIDDEN;
  }

  /** Whether a record (its `visibility` field) is listed on that surface. */
  static shownIn(record: unknown, surface: PublicListingSurface): boolean {
    return PublicListing.resolve((record as Record<string, unknown> | null | undefined)?.[PublicListing.FIELD]).lists(surface);
  }

  /**
   * The same rule as a collection READ RULE constraint, for a public collection's generic list reads:
   * `{ visibility: { $in: [values listed there], $orNull: true } }`. Apply it to LIST reads only — a read
   * of one record by its link must still find a Hidden record.
   */
  static readConstraint(surface: PublicListingSurface): Record<string, unknown> {
    const listed = (PublicListing.values() as PublicListing[]).filter((member) => member.lists(surface)).map((member) => member.value);
    return { [PublicListing.FIELD]: { $in: listed, $orNull: true } };
  }

  /**
   * A public collection's read-rule part for listing: a read of ONE record by its link finds it whatever
   * its Visibility, and any other read is a list and gets {@link readConstraint}.
   *
   * One record means a path id, or a single plain value for one of `pinningKeys` (`?slug=summer`). That
   * value is returned as an equality the read must ALSO satisfy, so a query that only looks pinned
   * (`?slug[in]=a,b`, a list of values) can never widen into a list of unlisted records.
   */
  static readRule(req: unknown, pinningKeys: readonly string[], surface: PublicListingSurface): Record<string, unknown> {
    const request = req as { params?: Record<string, unknown>; query?: Record<string, unknown> } | null | undefined;
    if (PublicListing.plainValue(request?.params?.id)) return {};
    for (const key of pinningKeys) {
      const value = PublicListing.plainValue(request?.query?.[key]);
      if (value) return { [key]: value };
    }
    return PublicListing.readConstraint(surface);
  }

  /** A query value naming exactly one thing: a non-empty string or number, never an operator object or a list. */
  private static plainValue(value: unknown): string {
    if (value === null || value === undefined || Object(value) === value) return '';
    const text = String(value).trim();
    return text.includes(',') ? '' : text;
  }

  /**
   * The `visibility` collection field, offering only the values that mean something for that collection
   * (a category is never searched, so it offers Public and Hidden). Labels are the owner's to translate.
   */
  static field(
    options: PublicListing[] = PublicListing.values() as PublicListing[],
    admin: Record<string, unknown> = {},
    labels: Partial<Record<string, string>> = {},
  ): Record<string, unknown> {
    return {
      name: PublicListing.FIELD,
      type: 'select',
      label: 'Visibility',
      defaultValue: PublicListing.PUBLIC.value,
      // `labels` lets a collection word an option for its own records ("Shown in lists" for a category).
      options: options.map((option) => ({ label: labels[option.value] ?? option.label, value: option.value })),
      admin: { position: 'sidebar', ...admin },
    };
  }
}

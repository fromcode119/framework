import { Enum } from '@fromcode119/react-class-components';

/**
 * Whether a site is open to the public yet — a different question from whether it is SUSPENDED.
 *
 * Suspension (`state`) removes a site's ADMIN and its background work: the api answers
 * `503 tenant_suspended` on the admin branch as well as the storefront one, and a suspended tenant
 * drops out of `listActive`, cron and CORS. That is right for a customer who has stopped paying and
 * useless for a site somebody is still building — it locks the operator out of the thing they are
 * trying to finish. So visibility is its own axis, and suspension outranks it: a suspended site
 * keeps whatever visibility it had, for when it is reactivated.
 *
 * Compare against `.value` — the column holds a raw string, and an Enum tested against a string is
 * always false.
 */
export class TenantVisibility extends Enum {
  /**
   * Not open to anyone. Anonymous visitors get a holding page; the site's own admins see the real
   * thing, so it can be built and reviewed before launch. The default for every new and imported
   * site: a site becomes visible when somebody says so, never by arriving.
   */
  static readonly PRIVATE = new TenantVisibility('private');

  /**
   * Reachable by anyone with the URL, but told not to index. The share-a-link-with-the-client case.
   *
   * It exists because the noindex path has to be built for PRIVATE anyway; this is the same
   * machinery without the door. Cheap to offer, and the alternative is operators making a site
   * public early and hoping nobody finds it before launch.
   */
  static readonly UNLISTED = new TenantVisibility('unlisted');

  /** Open and indexable. */
  static readonly PUBLIC = new TenantVisibility('public');

  private constructor(value: string) {
    super(value);
  }

  /**
   * The member a stored or wire value names, or null when it names none.
   *
   * `find`, never a defaulting `resolve`: this decides whether a site is served to the public, and a
   * value nobody can name must not fall through to the most permissive answer.
   */
  static find(value: unknown): TenantVisibility | null {
    if (value instanceof TenantVisibility) return value;
    return (TenantVisibility.fromValue(String(value ?? '').trim().toLowerCase()) as TenantVisibility | undefined) ?? null;
  }

  /** What an operator may choose, for the form that asks. */
  static definitions(): Array<{ label: string; value: string; description: string }> {
    return [
      {
        value: String(TenantVisibility.PRIVATE.value),
        label: 'Private',
        description: 'Visitors see a holding page. Search engines are told not to index it. The site\'s own admins see the real site.',
      },
      {
        value: String(TenantVisibility.UNLISTED.value),
        label: 'Unlisted',
        description: 'Anyone with the address can read it, but search engines are told not to index it.',
      },
      {
        value: String(TenantVisibility.PUBLIC.value),
        label: 'Public',
        description: 'Open to everyone and indexable.',
      },
    ];
  }

  /** Whether an anonymous visitor may read the site at all. */
  get isReadable(): boolean {
    return this !== TenantVisibility.PRIVATE;
  }

  /** Whether search engines may index it. Only a PUBLIC site is ever indexable. */
  get isIndexable(): boolean {
    return this === TenantVisibility.PUBLIC;
  }
}

/**
 * What the platform says to a crawler when indexing is refused.
 *
 * ONE spelling, because two surfaces emit it — the console (every response through `admin-proxy`)
 * and the api (every response on a host with no tenant). It was written out in the admin only, and
 * the api emitted no header at all: `robots.txt` asks a crawler not to FETCH, which does not stop a
 * URL that was linked from somewhere else appearing in an index by its address alone. The header is
 * the half that covers that case, so both surfaces need it and both need it to say the same thing.
 *
 * A deep-importable constants module rather than a barrel export: `admin-proxy` reaches this from
 * Next's middleware graph, where a core barrel import pulls in a class component and 500s the
 * console.
 */
export class RobotsConstants {
  /** The `X-Robots-Tag` value that refuses indexing, archiving and link-following. */
  static readonly REFUSE = 'noindex, nofollow, noarchive';

  /** The header itself. */
  static readonly HEADER = 'X-Robots-Tag';
}

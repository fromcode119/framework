/**
 * The STOREFRONT path a share link points at — `/files/<token>`.
 *
 * Deliberately separate from `RouteConstants.SEGMENTS.FILES`, which happens to spell the same word but
 * means the API router's mount point. They are two different addresses that only look alike: one is a
 * Next route on the frontend host, the other an Express router under `/api/v1`. Collapsing them into
 * one constant would make renaming either silently repoint the other.
 *
 * Also the content-page slug a theme seeds to brand that page, so the link, the route directory and the themed
 * page all read from here.
 */
export class FileSharePageSlug {
  /** No leading slash: callers join it onto a base URL. */
  static readonly PATH = 'files';

  /** The content-page slug a theme seeds to wrap the share panel in its own chrome. */
  static readonly CONTENT_PAGE_SLUG = 'files';
}

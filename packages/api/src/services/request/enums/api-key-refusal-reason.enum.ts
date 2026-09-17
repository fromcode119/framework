import { Enum } from '@fromcode119/react-class-components';

/**
 * WHY an api-key request was not bound to a site.
 *
 * Each one is a different HTTP status and a different thing for the caller to do, which is why they
 * are not collapsed: an expired token is 401 and needs a new token, a missing site header is 400 and
 * needs a header, a site that does not exist is 404, and a token pointed at someone else's site is
 * 403 — the one that must never read as 404, because "not found" would tell a caller nothing while
 * "forbidden" tells them the token is wrong.
 *
 * Carried as a VALUE: it is sent to the client as `{ error }` and used as the key into the status map.
 */
export class ApiKeyRefusalReason extends Enum {
  /** No such token, or it has expired. */
  static readonly INVALID_TOKEN = new ApiKeyRefusalReason('invalid_token');

  /** An all-sites token that did not say which site this request is for. */
  static readonly SITE_REQUIRED = new ApiKeyRefusalReason('site_required');

  /** The named site does not exist. */
  static readonly UNKNOWN_SITE = new ApiKeyRefusalReason('unknown_site');

  /** The token belongs to a different site than the one it named. */
  static readonly SITE_MISMATCH = new ApiKeyRefusalReason('site_mismatch');

  private constructor(value: string) {
    super(value);
  }
}

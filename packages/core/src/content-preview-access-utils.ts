import { StringUtils } from '@core/string-utils';

/**
 * The ONE answer to "may this request see unpublished content?".
 *
 * Preview is an AUTHORIZATION decision, never a request-shaped one. Both read paths used to compute
 * it as `isAdmin || CoercionUtils.toBoolean(req.query.preview)`, where the right-hand side is fully
 * caller-controlled — so `?preview=1` (or `?draft=1`) on any anonymous request read every draft, and
 * the `isAdmin` term could never be the deciding factor. Reproduced 2026-08-10 against a live draft
 * page: anonymous + `?preview=1` answered 200 with the full draft.
 *
 * The rule now: a query parameter can NEVER grant preview. Only the session's own roles/permissions
 * can, and the framework owns that answer so no controller re-derives it:
 * - the `admin` role, or the `*` permission — full access, same as every other admin bypass;
 * - the `content:read` permission — the seeded `editor` role's grant, and already the permission the
 *   framework requires for its other content-reading endpoints (`system-router` shortcodes and data
 *   sources). Hierarchical wildcards match the way {@link UserPermissionChecker} matches them, so
 *   `content:*` grants it too.
 *
 * A role that should preview but holds neither gets there by being granted `content:read` in admin →
 * Roles, which is an operator-visible control — not by a new branch in here.
 */
export class ContentPreviewAccessUtils {
  /** The permission that grants preview of unpublished content. */
  static readonly PREVIEW_PERMISSION = 'content:read';

  private static readonly ADMIN_ROLE = 'admin';
  private static readonly SUPER_PERMISSION = '*';

  /**
   * True when this request's authenticated user may read unpublished (draft/scheduled) records.
   * Anonymous requests are always false — there is no session to authorize.
   */
  static canPreviewUnpublished(user: unknown): boolean {
    if (!user) {
      return false;
    }

    const account = user as { roles?: unknown; permissions?: unknown };
    if (StringUtils.normalizeSlugList(account.roles).includes(ContentPreviewAccessUtils.ADMIN_ROLE)) {
      return true;
    }

    return ContentPreviewAccessUtils.grantsPermission(
      StringUtils.normalizeSlugList(account.permissions),
      ContentPreviewAccessUtils.PREVIEW_PERMISSION,
    );
  }

  /**
   * Exact match, the global `*`, or a hierarchical wildcard (`content:*` covers `content:read`) —
   * the same three cases the database-backed permission checker resolves, so a permission behaves
   * identically whether it is read from the session or looked up per request.
   */
  private static grantsPermission(granted: string[], required: string): boolean {
    if (granted.includes(ContentPreviewAccessUtils.SUPER_PERMISSION) || granted.includes(required)) {
      return true;
    }

    return granted.some((entry) => entry.endsWith(':*') && required.startsWith(entry.slice(0, -1)));
  }
}

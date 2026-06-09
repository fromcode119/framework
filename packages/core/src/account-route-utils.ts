import { RouteConstants } from './route-constants';

/**
 * Single source of truth for the account section URL shape (`/account`, `/account/:section`).
 * Both the framework (page contracts, AccountShell) and themes parse/build account URLs through this
 * helper instead of hardcoding `/account` regexes, so the URL form lives in exactly one place.
 */
export class AccountRouteUtils {
  /** Base account path, e.g. `/account`. */
  static base(): string {
    return RouteConstants.SEGMENTS.ACCOUNT;
  }

  /** Parameterized section contract path, e.g. `/account/:section`. */
  static sectionPattern(): string {
    return RouteConstants.SEGMENTS.ACCOUNT_SECTION;
  }

  /** Extract the section slug from a pathname (`/account/orders` → `orders`); `''` for the index. */
  static parseSection(pathname: string): string {
    const base = AccountRouteUtils.base().replace(/\/+$/, '');
    const match = String(pathname || '').match(new RegExp(`^${base}/([^/?#]+)`));
    return match ? decodeURIComponent(match[1]).trim().toLowerCase() : '';
  }

  /** Build the path for a section (`orders` → `/account/orders`; empty → `/account`). */
  static sectionPath(section?: string): string {
    const base = AccountRouteUtils.base().replace(/\/+$/, '');
    const slug = String(section || '').trim().toLowerCase();
    return slug ? `${base}/${encodeURIComponent(slug)}` : base;
  }
}

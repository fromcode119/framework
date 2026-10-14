import React from 'react';

import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { PlatformAccess } from '@/lib/tenants/platform-access';
import { TenantOption } from '@/lib/tenants/tenant-option';
import type { IUser } from '@/components/interfaces/user.interface';

/**
 * Which site is this admin session working in — and must it choose one before anything else?
 *
 * An account's admin role can live on a MEMBERSHIP ("admin of fromcode"), and a membership only
 * applies while that site is in scope. On the shared admin host the site comes from the signed
 * session claim, which login sets only when exactly one site is reachable. Reach two, and the
 * session stayed site-less: every request was then judged by the account's GLOBAL roles, so a site
 * administrator whose global role is `customer` was refused by every screen in turn, each reporting
 * its own failure. Nothing was broken and nothing said "pick a site".
 *
 * So the choice becomes a step of its own, on the same endpoints the header switcher uses. Who is
 * asked, and who is not:
 *   • tenancy off, or a site already selected — nothing to ask.
 *   • a PLATFORM admin — works above sites (Sites, Plugins, Themes are platform surfaces) and picks
 *     a site from the header when it wants one. Blocking it would lock the platform out of itself.
 *     With exactly ONE site, though, there is nothing to pick: the session enters it, as login does,
 *     unless it stepped out to the platform on purpose (`platformChosen`). Otherwise a session minted
 *     before the site existed stayed outside it — every plugin page missing from the menu, nothing
 *     saying why.
 *   • no reachable site — there is nothing to choose; the account is told so instead of being shown
 *     an admin where every screen fails.
 *   • otherwise — choose, then the membership's roles apply for that site.
 */
export class ClientLayoutSiteStateHooks {
  static useState(user: IUser | null | undefined, isAuthPage: boolean) {
    const [tenants, setTenants] = React.useState<TenantOption[]>([]);
    const [current, setCurrent] = React.useState<string | null>(null);
    const [multiTenant, setMultiTenant] = React.useState(false);
    // `null` while unknown: the shell must not flash a picker at an account that already has a site.
    const [loaded, setLoaded] = React.useState<boolean | null>(null);
    const platformAdmin = PlatformAccess.canManagePlatform(user);

    React.useEffect(() => {
      if (!user || isAuthPage) {
        setLoaded(null);
        return;
      }
      let live = true;
      AdminApi.get(AdminConstants.ENDPOINTS.AUTH.TENANTS_AVAILABLE)
        .then((response: any) => {
          if (!live) return;
          if (platformAdmin) {
            ClientLayoutSiteStateHooks.enterOnlySite(response);
            setLoaded(null);
            return;
          }
          setMultiTenant(response?.multiTenant === true);
          setCurrent(response?.current ?? null);
          setTenants(TenantOption.fromList(response?.tenants));
          setLoaded(true);
        })
        // Fail CLOSED on the QUESTION, not on the admin: an unanswerable "which site?" leaves the
        // session exactly as it was, and the screens report their own state as they always did.
        .catch(() => { if (live) setLoaded(false); });
      return () => { live = false; };
    }, [user, isAuthPage, platformAdmin]);

    return {
      tenants,
      /**
       * No site is in scope, so the session cannot act on one. True with an EMPTY list too — an
       * account that reaches nothing must be told that, not handed an admin where every screen fails.
       */
      mustChooseSite: loaded === true && multiTenant && !current,
    };
  }

  /** A platform admin outside every site, on an install with exactly one, enters it — the login rule. */
  static enterOnlySite(response: any): void {
    const only = ClientLayoutSiteStateHooks.onlySiteToEnter(response);
    if (!only) return;
    AdminApi.post(AdminConstants.ENDPOINTS.AUTH.TENANTS_SELECT, { tenantId: only })
      .then(() => window.location.reload())
      .catch(() => undefined);
  }

  /** The site to enter, or `''`: tenancy on, no site bound, not stepped out on purpose, exactly one site. */
  static onlySiteToEnter(response: any): string {
    if (response?.multiTenant !== true || response?.current || response?.locked || response?.platformChosen === true) return '';
    const tenants = TenantOption.fromList(response?.tenants);
    return tenants.length === 1 ? tenants[0].id : '';
  }
}

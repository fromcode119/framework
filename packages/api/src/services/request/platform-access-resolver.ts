import { TenantMembershipService, TenantMode } from '@fromcode119/core';

/**
 * Is the caller a PLATFORM admin — someone who may act on the shared container itself?
 *
 * On a multi-tenant deployment the `admin` role means "admin of MY site". It does not mean the
 * account may install code onto the box every other customer runs on, delete a plugin they all use,
 * or switch the theme under them. Those are platform actions, and this is the one place that decides
 * who may take them, so the guard on the routes and the filter on the listings cannot disagree.
 *
 * On a single-tenant deployment there is only one operator and the `admin` role IS the platform, so
 * every admin answers yes — exactly as before tenancy existed.
 *
 * Memoised per request: the guard and the controller both ask, and the account has not changed
 * between one middleware and the next.
 */
export class PlatformAccessResolver {
  private static readonly MEMO = Symbol('platformAdmin');

  constructor(private readonly db: any) {}

  async isPlatformAdmin(req: any): Promise<boolean> {
    if (!TenantMode.isEnabled()) return true;

    const memo = (req as Record<symbol, unknown>)[PlatformAccessResolver.MEMO];
    if (typeof memo === 'boolean') return memo;

    const userId = String(req?.user?.id ?? '').trim();
    const answer = userId
      ? await new TenantMembershipService(this.db).isPlatformAdminAccount(userId)
      : false;
    (req as Record<symbol, unknown>)[PlatformAccessResolver.MEMO] = answer;
    return answer;
  }
}

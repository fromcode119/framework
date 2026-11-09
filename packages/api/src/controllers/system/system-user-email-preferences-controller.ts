import type { Request, Response } from 'express';
import { CoercionUtils, EmailCategoryAudience, StringUtils, SystemConstants } from '@fromcode119/core';
import { SystemEmailPreferencesController } from '@api/controllers/system/system-email-preferences-controller';
import { TenantUserScope } from '@api/services/request/tenant-user-scope';
import { SiteRoleScope } from '@api/services/tenants/site-role-scope';

/**
 * The same preferences surface, for an administrator setting them on SOMEONE ELSE'S behalf.
 *
 * It subclasses rather than copies: listing the streams, refusing an unknown or locked one and flipping
 * a suppression are identical to the person's own screen. The only differences are who the request acts
 * for and who may do it.
 *
 *  - WHO IT ACTS FOR comes from the route's `:id`, never from the body, and only if that account is a
 *    member of the caller's site — anything else is "not found", not "forbidden", for the reason
 *    {@link TenantUserScope} gives (a refusal would confirm the account exists).
 *  - WHO MAY is decided by the route: `users:view` to read, `users:manage` to change. The alerts sent to
 *    administrators are offered only for an account that is itself an administrator here — the same
 *    audience `notifyAdmins` resolves — so nobody is shown a switch for something they never receive.
 */
export class SystemUserEmailPreferencesController extends SystemEmailPreferencesController {
  private static readonly TARGET = '__preferencesTarget';

  protected get suppressionSource(): string {
    return 'admin:user-preferences';
  }

  /** The account this request is for, resolved once and remembered on the request. */
  private async resolve(req: Request): Promise<{ email: string; isAdmin: boolean } | null> {
    const id = CoercionUtils.toRelationId(req.params?.id);
    if (id === null) return null;
    if (!(await TenantUserScope.of(req, this.manager.db)).allows(id)) return null;
    const user: any = await this.manager.db.findOne(SystemConstants.TABLE.USERS, { id }).catch(() => null); // eslint-disable-line @typescript-eslint/no-explicit-any
    const email = String(user?.email ?? '').trim().toLowerCase();
    if (!email) return null;
    const target = { email, isAdmin: (await this.rolesOf(id, user)).includes('admin') };
    (req as any)[SystemUserEmailPreferencesController.TARGET] = target; // eslint-disable-line @typescript-eslint/no-explicit-any
    return target;
  }

  /**
   * What the account holds HERE: its membership's roles on a site (the ones that authorize it there),
   * else its own grants — the same answer the Users screen gives, so "administrator" means one thing.
   */
  private async rolesOf(id: number, user: any): Promise<string[]> { // eslint-disable-line @typescript-eslint/no-explicit-any
    const scoped = (await SiteRoleScope.current(this.manager.db))?.rolesOf(id);
    if (scoped) return StringUtils.normalizeSlugList(scoped);
    const granted = await this.manager.db.find(SystemConstants.TABLE.USERS_ROLES, { where: { user_id: id } }).catch(() => []);
    return StringUtils.normalizeSlugList([
      ...StringUtils.normalizeSlugList(user?.roles),
      ...(Array.isArray(granted) ? granted : []).map((row: any) => row?.role_slug ?? row?.roleSlug), // eslint-disable-line @typescript-eslint/no-explicit-any
    ]);
  }

  protected async resolveAddress(req: Request): Promise<string> {
    return (req as any)[SystemUserEmailPreferencesController.TARGET]?.email ?? ''; // eslint-disable-line @typescript-eslint/no-explicit-any
  }

  /**
   * An administrator's alerts are muted only by another administrator: `users:manage` alone must not be
   * enough to silence what an administrator is told, so the caller is held to the same rule as the
   * person's own screen, AND the account must be one the alerts are sent to.
   */
  protected mayManage(req: Request, audience: EmailCategoryAudience): boolean {
    if (!super.mayManage(req, audience)) return false;
    if (audience === EmailCategoryAudience.PERSON) return true;
    return (req as any)[SystemUserEmailPreferencesController.TARGET]?.isAdmin === true; // eslint-disable-line @typescript-eslint/no-explicit-any
  }

  async list(req: Request, res: Response): Promise<void> {
    if (!(await this.resolve(req))) { res.status(404).json({ error: 'User not found' }); return; }
    await super.list(req, res);
  }

  async update(req: Request, res: Response): Promise<void> {
    if (!(await this.resolve(req))) { res.status(404).json({ error: 'User not found' }); return; }
    await super.update(req, res);
  }
}

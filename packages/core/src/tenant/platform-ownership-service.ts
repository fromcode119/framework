import { SystemConstants } from '@core/constants/system.constants';
import { CoercionUtils } from '@core/coercion-utils';
import { StringUtils } from '@core/string-utils';
import { PlatformOwnershipError } from '@core/tenant/platform-ownership-error';

/**
 * The platform OWNER seat: exactly one account holds it, and only that account can hand it on.
 *
 * Modelled on ownership rather than a permission: the holder transfers the seat to someone else and
 * becomes a plain admin in the same move. That is what makes the seat safe to protect absolutely — an
 * owner can never be deleted, so control of the platform cannot be lost, and it is still not a row
 * nobody can ever correct, because it can always be handed over.
 *
 * Framework-owned and read through the RAW database manager, so column names are snake_case here.
 */
export class PlatformOwnershipService {
  /** The role the previous owner keeps, and the one a new owner is guaranteed. */
  private static readonly ADMIN_ROLE = 'admin';

  constructor(private readonly db: any) {}

  /** The account holding the seat, or `null` when an install has never had one. */
  async currentOwnerId(): Promise<number | null> {
    const rows = await this.db.find(SystemConstants.TABLE.USERS, {
      where: { is_platform_admin: true },
      limit: 1,
    });
    return CoercionUtils.toRelationId(rows?.[0]?.id);
  }

  async isOwner(userId: unknown): Promise<boolean> {
    const id = CoercionUtils.toRelationId(userId);
    if (id === null) return false;
    return id === await this.currentOwnerId();
  }

  /**
   * Hands the seat from its current holder to another account.
   *
   * Everything happens inside one exclusive transaction: between clearing the old flag and setting the
   * new one there is a moment with no owner at all, and a concurrent transfer reading that moment would
   * see an install it believes has never had an owner. Returning commits; throwing rolls back, which is
   * what guarantees the seat is never lost in the middle.
   */
  async transfer(fromUserId: unknown, toUserId: unknown): Promise<void> {
    const from = CoercionUtils.toRelationId(fromUserId);
    const to = CoercionUtils.toRelationId(toUserId);
    if (from === null || to === null) {
      throw new PlatformOwnershipError(400, 'Both the current owner and the new owner must be identified.');
    }
    if (from === to) {
      throw new PlatformOwnershipError(400, 'That account already owns the platform.');
    }

    await this.db.withExclusiveLock('platform-owner-transfer', async () => {
      if (from !== await this.currentOwnerId()) {
        throw new PlatformOwnershipError(403, 'Only the current owner can transfer ownership of the platform.');
      }

      const target = await this.db.findOne(SystemConstants.TABLE.USERS, { id: to });
      if (!target) {
        throw new PlatformOwnershipError(404, 'The account receiving ownership no longer exists.');
      }

      // Clear FIRST: the single-owner index rejects a second holder, so setting before clearing would
      // fail on every transfer rather than only on a genuine conflict.
      await this.db.update(SystemConstants.TABLE.USERS, { id: from }, { is_platform_admin: false });
      await this.db.update(SystemConstants.TABLE.USERS, { id: to }, { is_platform_admin: true });
      await this.grantAdminRole(target);
    });
  }

  /**
   * An owner without the `admin` role would hold the platform seat and still be refused by every
   * ordinary admin route, so the role is guaranteed rather than assumed.
   */
  private async grantAdminRole(target: any): Promise<void> {
    const roles = StringUtils.normalizeSlugList(CoercionUtils.parseJson(target?.roles, []) as string[]);
    if (roles.includes(PlatformOwnershipService.ADMIN_ROLE)) return;

    const next = [...roles, PlatformOwnershipService.ADMIN_ROLE];
    await this.db.update(SystemConstants.TABLE.USERS, { id: target.id }, { roles: next });
    await this.db.insert(SystemConstants.TABLE.USERS_ROLES, {
      userId: target.id,
      roleSlug: PlatformOwnershipService.ADMIN_ROLE,
    }).catch(() => undefined);
  }
}

import { Response } from 'express';
import { NetworkAddressUtils, SystemConstants } from '@fromcode119/core';
import { AuthControllerSession } from '@api/controllers/auth/auth-controller-session';
import { CoercionUtils } from '@fromcode119/core';
import { PersonalDataErasureService } from '@fromcode119/core';
import { ReadOnlyOverrideGrantUtils } from '@api/utils/read-only-override-grant-utils';

export class AuthControllerAccount extends AuthControllerSession {
  async verifyPassword(req: any, res: Response) {
    const userId = this.parseUserId(req.user?.id);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const password = CoercionUtils.toString(req.body?.password);
    if (!password) return res.status(400).json({ error: 'Password is required' });

    const user = await this.db.findOne(SystemConstants.TABLE.USERS, { id: userId });

    if (!user) return res.status(404).json({ error: 'User not found' });

    const matches = await this.auth.comparePassword(password, String(user.password || ''));
    if (!matches) return res.status(400).json({ error: 'Current password is invalid' });

    return res.json({ success: true, ...(await this.mintRequestedGrant(req, userId)) });
  }

  /**
   * Turns a successful re-authentication into a short-lived, scoped GRANT, so the caller never has to
   * keep the password to prove it later.
   *
   * This endpoint used to answer a bare `{ success: true }` and ignore the `purpose`/`collectionSlug`/
   * `recordId` the admin already sent it — which is why the read-only override had to hold the account
   * password in browser memory and replay it in the record body on every save. A caller that asks for
   * no known purpose still gets the bare answer, so the plain "confirm it is you" use keeps working.
   */
  private async mintRequestedGrant(req: any, userId: string | number): Promise<Record<string, unknown>> {
    const purpose = CoercionUtils.toString(req.body?.purpose);
    if (purpose !== ReadOnlyOverrideGrantUtils.PURPOSE) return {};

    const collectionSlug = CoercionUtils.toString(req.body?.collectionSlug);
    if (!collectionSlug) return {};

    const grant = await this.auth.generateGrantToken({
      userId,
      purpose,
      scope: ReadOnlyOverrideGrantUtils.scope(collectionSlug, req.body?.recordId),
    });
    return { grant };
  }

  /**
   * GDPR data export — everything this site holds about the signed-in user (no password, no secrets).
   *
   * DELEGATES to `PersonalDataErasureService.exportAll`, the same walk a DSAR export runs, for the
   * same reason `deleteMyAccount` delegates to `eraseAll`: two doors to one right must not disagree.
   * This used to assemble an account and a person record by hand — two objects — while the identical
   * request through a DSAR returned sixteen datasets including the subject's orders, invoices, form
   * submissions and affiliate record. Someone exercising Art. 15 from their own account page was
   * told, in effect, that the platform held almost nothing about them.
   *
   * `account` stays as a named object on the response because clients read it; it is now taken from
   * the walk rather than assembled a second time.
   */
  async exportMyData(req: any, res: Response) {
    const userId = this.parseUserId(req.user?.id);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const user = await this.db.findOne(SystemConstants.TABLE.USERS, { id: userId });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const datasets = await new PersonalDataErasureService(this.db)
      .exportAll({ email: String(user.email ?? ''), userId });

    const account = {
      id: user.id, email: this.normalizeEmail(user.email), username: user.username ?? null,
      firstName: user.firstName ?? user.first_name ?? null, lastName: user.lastName ?? user.last_name ?? null,
      roles: this.readRoles(user), createdAt: user.createdAt ?? user.created_at ?? null,
    };

    return res.json({ exportedAt: new Date().toISOString(), account, datasets });
  }

  /**
   * GDPR erasure — the signed-in user deletes their OWN account. Password-gated, irreversible.
   *
   * DELEGATES to `PersonalDataErasureService`, which is the same code a DSAR erasure runs. There
   * were two implementations of "erase a person" in this codebase and they disagreed: this one
   * tombstoned the account and nothing else, leaving the person record, its addresses, the site
   * membership and every journal entry untouched. Worse, it tombstoned the account UNCONDITIONALLY —
   * and `users` has no `tenant_id`, so one account can administer several sites. Somebody closing
   * their account on one site took their own login away on every other site they held.
   *
   * The service applies the rule that fixes both: erase everything belonging to THIS site, and
   * tombstone the shared account only when this site was the last one holding it. When it is not,
   * the account survives and the caller is told why.
   *
   * Locking sign-in stays HERE: hashing is the auth manager's business, not the database layer's.
   */
  async deleteMyAccount(req: any, res: Response) {
    const userId = this.parseUserId(req.user?.id);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const password = CoercionUtils.toString(req.body?.password);
    if (!password) return res.status(400).json({ error: 'Password is required' });
    const user = await this.db.findOne(SystemConstants.TABLE.USERS, { id: userId });
    if (!user) return res.status(404).json({ error: 'User not found' });
    const matches = await this.auth.comparePassword(password, String(user.password || ''));
    if (!matches) return res.status(400).json({ error: 'Current password is invalid' });

    const erasure = new PersonalDataErasureService(this.db);
    const subject = { email: String(user.email ?? ''), userId };
    // Every dataset the platform holds — its own seven and every plugin's — each under the operator's
    // policy for this site. This used to hand-list four of the seven, so a self-delete left the
    // subject's email and IP in the journals while the same person asking through a DSAR had them
    // anonymised; and until the policy moved into core it still ran on declared defaults while a DSAR
    // ran on the operator's choices. No override is passed: a subject may not elect their own
    // retention.
    const results = await erasure.eraseAll(subject);
    const account = results[PersonalDataErasureService.ACCOUNT_ID];

    // Sign-in is locked either way: the person asked to be gone from this site, and a live password
    // on a retained account is not what they asked for.
    const lockedHash = await this.auth.hashPassword(`deleted-${userId}-${Math.random().toString(36).slice(2)}`);
    await this.db.update(SystemConstants.TABLE.USERS, { id: userId }, { password: lockedHash, updatedAt: new Date() });
    await this.revokeAllSessionsForUser(userId);
    await this.manager.writeLog('INFO', `Account self-deleted for user ${userId}`, 'system', { userId, ip: NetworkAddressUtils.resolveClientIp(req) }).catch(() => {});

    // An account is kept for two different reasons and the subject must be told which. `retained > 0`
    // only ever means "shared with another site"; a RETAIN strategy keeps the row and reports zero of
    // everything, so reading the count alone told someone whose operator had chosen retention that
    // their account had been deleted. That is the one sentence a subject exercising Art. 17 must be
    // able to rely on, so it is decided from the STRATEGY that actually ran.
    const keptByPolicy = account.strategy === PersonalDataErasureService.RETAIN_STRATEGY;
    const keptAsShared = account.retained > 0;

    return res.json({
      success: true,
      message: AuthControllerAccount.outcomeMessage(keptByPolicy, keptAsShared),
      accountRetained: keptByPolicy || keptAsShared,
      accountRetainedReason: (keptByPolicy ? account.reason : account.retainedReason) || '',
    });
  }

  /** What the subject is told, per reason the account survived. Never "deleted" when it was not. */
  private static outcomeMessage(keptByPolicy: boolean, keptAsShared: boolean): string {
    if (keptByPolicy) {
      return 'Your data on this site has been deleted. Your sign-in account is kept under this site\'s '
        + 'retention policy, and the reason is stated below.';
    }
    if (keptAsShared) {
      return 'Your data on this site has been deleted. Your sign-in account is shared with other sites '
        + 'and was kept there.';
    }
    return 'Your account has been deleted.';
  }

  async changePassword(req: any, res: Response) {
    const userId = this.parseUserId(req.user?.id);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { currentPassword, newPassword, revokeOtherSessions } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    const user = await this.db.findOne(SystemConstants.TABLE.USERS, { id: userId });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const currentMatches = await this.auth.comparePassword(String(currentPassword), String(user.password || ''));
    if (!currentMatches) {
      return res.status(400).json({ error: 'Current password is invalid' });
    }

    const passwordError = await this.validatePasswordAgainstPolicy(String(newPassword), {
      userId,
      email: this.normalizeEmail(user.email),
      currentPasswordHash: String(user.password || '')
    });
    if (passwordError) {
      return res.status(400).json({ error: passwordError });
    }

    const hashed = await this.auth.hashPassword(String(newPassword));
    await this.db.update(SystemConstants.TABLE.USERS, { id: userId }, { password: hashed, updatedAt: new Date() });
    await this.pushPasswordHistory(userId, hashed);
    await this.upsertMeta(this.getPasswordChangedAtKey(userId), new Date().toISOString());
    await this.setForcePasswordReset(userId, false);

    if (revokeOtherSessions !== false) {
      await this.revokeOtherSessionsForUser(userId, String(req.user?.jti || ''));
    }

    await this.manager.writeLog(
      'INFO',
      `Password changed for ${user.email}`,
      'system',
      { userId, email: user.email, ip: NetworkAddressUtils.resolveClientIp(req), revokeOtherSessions: revokeOtherSessions !== false }
    ).catch(() => {});

    await this.sendSecurityNotification({
      userId,
      to: this.normalizeEmail(user.email),
      subject: 'Your password was changed',
      title: 'Your account password was changed successfully.',
      details: [`Time: ${new Date().toISOString()}`]
    });

    return res.json({ success: true, message: 'Password changed successfully.' });
  }
}

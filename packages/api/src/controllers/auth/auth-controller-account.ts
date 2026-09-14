import { TokenErrorReason } from '@api/controllers/auth/enums/token-error-reason.enum';
import { Request, Response } from 'express';
import { SystemConstants } from '@fromcode119/core';
import { AuthControllerSession } from '@api/controllers/auth/auth-controller-session';
import { CoercionUtils } from '@fromcode119/core';
import { PersonalDataErasureService } from '@fromcode119/core';

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

    return res.json({ success: true });
  }

  /** GDPR data export — the signed-in user's own account + person record as JSON (no password/secrets). */
  async exportMyData(req: any, res: Response) {
    const userId = this.parseUserId(req.user?.id);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const user = await this.db.findOne(SystemConstants.TABLE.USERS, { id: userId });
    if (!user) return res.status(404).json({ error: 'User not found' });
    let person: any = null;
    try { person = await this.db.findOne(SystemConstants.TABLE.PEOPLE, { userId }); } catch { person = null; }
    const account = {
      id: user.id, email: this.normalizeEmail(user.email), username: user.username ?? null,
      firstName: user.firstName ?? user.first_name ?? null, lastName: user.lastName ?? user.last_name ?? null,
      roles: this.readRoles(user), createdAt: user.createdAt ?? user.created_at ?? null,
    };
    return res.json({ exportedAt: new Date().toISOString(), account, person: person || null });
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
    // Order matters: the account check reads the memberships, so it runs before they are removed.
    const account = await erasure.eraseDataset('account', subject, 'anonymise');
    await erasure.eraseDataset('person', subject, 'delete');
    await erasure.eraseDataset('roles', subject, 'delete');
    await erasure.eraseDataset('record-versions', subject, 'delete');

    // Sign-in is locked either way: the person asked to be gone from this site, and a live password
    // on a retained account is not what they asked for.
    const lockedHash = await this.auth.hashPassword(`deleted-${userId}-${Math.random().toString(36).slice(2)}`);
    await this.db.update(SystemConstants.TABLE.USERS, { id: userId }, { password: lockedHash, updatedAt: new Date() });
    await this.revokeAllSessionsForUser(userId);
    await this.manager.writeLog('INFO', `Account self-deleted for user ${userId}`, 'system', { userId, ip: req.ip }).catch(() => {});

    return res.json({
      success: true,
      message: account.retained > 0
        ? 'Your data on this site has been deleted. Your sign-in account is shared with other sites and was kept there.'
        : 'Your account has been deleted.',
      accountRetained: account.retained > 0,
      accountRetainedReason: account.retainedReason ?? '',
    });
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
      { userId, email: user.email, ip: req.ip, revokeOtherSessions: revokeOtherSessions !== false }
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

  async requestEmailChange(req: any, res: Response) {
    const userId = this.parseUserId(req.user?.id);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const newEmail = this.normalizeEmail(req.body?.newEmail);
    const currentPassword = CoercionUtils.toString(req.body?.currentPassword);

    if (!newEmail || !this.isValidEmail(newEmail)) {
      return res.status(400).json({ error: 'A valid new email is required' });
    }
    if (!currentPassword) {
      return res.status(400).json({ error: 'Current password is required' });
    }

    const user = await this.db.findOne(SystemConstants.TABLE.USERS, { id: userId });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const oldEmail = this.normalizeEmail(user.email);
    if (oldEmail === newEmail) {
      return res.status(400).json({ error: 'New email must be different from current email' });
    }

    const passwordOk = await this.auth.comparePassword(currentPassword, String(user.password || ''));
    if (!passwordOk) {
      return res.status(400).json({ error: 'Current password is invalid' });
    }

    const existing = await this.db.findOne(SystemConstants.TABLE.USERS, { email: newEmail });
    if (existing) {
      return res.status(409).json({ error: 'This email is already used by another account' });
    }

    const issued = await this.issueEmailChangeToken(userId, oldEmail, newEmail);
    const confirmUrl = await this.buildEmailChangeUrl(req, issued.token);
    const sent = await this.sendEmailChangeVerificationEmail({
      to: newEmail,
      confirmUrl,
      firstName: this.readUserFirstName(user)
    });

    await this.sendSecurityNotification({
      userId,
      to: oldEmail,
      subject: 'Email change requested',
      title: 'A request to change your account email was received.',
      details: [
        `New email: ${newEmail}`,
        `Time: ${new Date().toISOString()}`
      ],
      allowSilentFailure: true
    });

    await this.manager.writeLog(
      'INFO',
      `Email change requested for ${oldEmail} -> ${newEmail}`,
      'system',
      { userId, oldEmail, newEmail, ip: req.ip, emailSent: sent }
    ).catch(() => {});

    const response: Record<string, any> = {
      success: true,
      message: 'Please confirm the change using the verification link sent to your new email.'
    };
    if (process.env.NODE_ENV !== 'production') {
      response.confirmUrl = confirmUrl;
      response.emailDelivery = sent ? 'sent' : 'failed';
    }
    return res.json(response);
  }

  async confirmEmailChange(req: Request, res: Response) {
    if (!(await this.isFrontendAuthEnabledForRequest(req))) {
      return res.status(404).json({ error: 'Not found' });
    }

    const token = CoercionUtils.toString(req.body?.token) || CoercionUtils.toString(req.query?.token);
    if (!token) return res.status(400).json({ error: 'Email change token is required' });

    const result = await this.consumeEmailChangeToken(token);
    if (!result.ok || !result.userId || !result.newEmail || !result.oldEmail) {
      return res.status(400).json({
        error: result.reason === TokenErrorReason.EXPIRED
          ? 'Email change link has expired. Please request a new one.'
          : 'Invalid email change token'
      });
    }

    const emailOwner = await this.db.findOne(SystemConstants.TABLE.USERS, { email: result.newEmail });
    if (emailOwner && Number(emailOwner.id) !== result.userId) {
      return res.status(409).json({ error: 'This email is already used by another account' });
    }

    await this.db.update(SystemConstants.TABLE.USERS, { id: result.userId }, { email: result.newEmail, updatedAt: new Date() });
    await this.setEmailVerified(result.userId, true);
    await this.revokeAllSessionsForUser(result.userId);

    await this.sendSecurityNotification({
      userId: result.userId,
      to: result.newEmail,
      subject: 'Email changed successfully',
      title: 'Your account email has been updated.',
      details: [`Previous email: ${result.oldEmail}`],
      allowSilentFailure: true
    });
    await this.sendSecurityNotification({
      userId: result.userId,
      to: result.oldEmail,
      subject: 'Email changed successfully',
      title: 'Your account email has been updated.',
      details: [`New email: ${result.newEmail}`],
      allowSilentFailure: true
    });

    await this.manager.writeLog(
      'INFO',
      `Email changed for user ${result.userId}: ${result.oldEmail} -> ${result.newEmail}`,
      'system',
      { userId: result.userId, oldEmail: result.oldEmail, newEmail: result.newEmail }
    ).catch(() => {});

    return res.json({
      success: true,
      message: 'Email changed successfully. Please sign in again.',
      email: result.newEmail
    });
  }
}

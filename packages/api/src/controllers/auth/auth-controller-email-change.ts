import { TokenErrorReason } from '@api/controllers/auth/enums/token-error-reason.enum';
import { Request, Response } from 'express';
import { CoercionUtils, NetworkAddressUtils, SystemConstants } from '@fromcode119/core';
import { AuthControllerAccount } from '@api/controllers/auth/auth-controller-account';

/**
 * Changing the address an account is reached at — a two-step flow, not a field edit.
 *
 * The new address must PROVE it is reachable before it replaces the old one, or a typo locks the
 * account out of its own password reset. So the request only issues a token, and the confirmation
 * does the write; both ends of the change are told about it, and every session is revoked, because
 * an email change is how an account takeover is finished.
 */
export class AuthControllerEmailChange extends AuthControllerAccount {
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
      { userId, oldEmail, newEmail, ip: NetworkAddressUtils.resolveClientIp(req), emailSent: sent }
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

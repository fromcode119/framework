import { Request, Response } from 'express';
import { SystemConstants } from '@fromcode119/core';
import { AuthControllerSession } from './auth-controller-session';

export class AuthControllerAccount extends AuthControllerSession {
  async verifyPassword(req: any, res: Response) {
    const userId = this.parseUserId(req.user?.id);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const password = String(req.body?.password || '');
    if (!password) return res.status(400).json({ error: 'Password is required' });

    const user = await this.db.findOne(SystemConstants.TABLE.USERS, { id: userId });

    if (!user) return res.status(404).json({ error: 'User not found' });

    const matches = await this.auth.comparePassword(password, String(user.password || ''));
    if (!matches) return res.status(400).json({ error: 'Current password is invalid' });

    return res.json({ success: true });
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
    const currentPassword = String(req.body?.currentPassword || '');

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

    const token = String(req.body?.token || req.query?.token || '').trim();
    if (!token) return res.status(400).json({ error: 'Email change token is required' });

    const result = await this.consumeEmailChangeToken(token);
    if (!result.ok || !result.userId || !result.newEmail || !result.oldEmail) {
      return res.status(400).json({
        error: result.reason === 'expired'
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

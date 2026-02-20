import { Request, Response } from 'express';
import { users, systemSessions, eq, and, gt, sql } from '@fromcode/database';
import { AuthControllerLifecycle } from './auth-controller-lifecycle';

export class AuthControllerAccount extends AuthControllerLifecycle {
  async logout(req: any, res: Response) {
    if (req.user && req.user.jti) {
      try {
        await this.db.update(systemSessions)
          .set({ isRevoked: true, updatedAt: new Date() })
          .where(eq(systemSessions.tokenId, req.user.jti));

        await this.manager.writeLog(
          'INFO',
          `User logged out: ${req.user.email}`,
          'system',
          { userId: req.user.id, email: req.user.email, jti: req.user.jti }
        );
      } catch {}
    }

    this.clearAuthCookies(req as Request, res);
    res.json({ success: true });
  }

  async getSessions(req: Request, res: Response) {
    try {
      const result = await this.db.select({
        id: systemSessions.id,
        userId: systemSessions.userId,
        tokenId: systemSessions.tokenId,
        userAgent: systemSessions.userAgent,
        ipAddress: systemSessions.ipAddress,
        isRevoked: systemSessions.isRevoked,
        expiresAt: systemSessions.expiresAt,
        createdAt: systemSessions.createdAt,
        updatedAt: systemSessions.updatedAt,
        email: users.email
      })
      .from(systemSessions)
      .innerJoin(users, eq(systemSessions.userId, users.id))
      .where(and(
        eq(systemSessions.isRevoked, false),
        gt(systemSessions.expiresAt, new Date())
      ))
      .orderBy(sql`${systemSessions.createdAt} DESC`);

      res.json(result);
    } catch {
      res.status(500).json({ error: 'Failed to fetch sessions' });
    }
  }

  async killSession(req: Request, res: Response) {
    const { id } = req.params;
    try {
      await this.db.update(systemSessions)
        .set({ isRevoked: true, updatedAt: new Date() })
        .where(eq(systemSessions.id, id));
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: 'Failed to kill session' });
    }
  }
  async changePassword(req: any, res: Response) {
    const userId = this.parseUserId(req.user?.id);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { currentPassword, newPassword, revokeOtherSessions } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    const user = await this.db.select().from(users).where(eq(users.id, userId)).limit(1).then((rows: any[]) => rows?.[0]);
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
    await this.db.update(users).set({ password: hashed, updatedAt: new Date() }).where(eq(users.id, userId));
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

  async getMySessions(req: any, res: Response) {
    const userId = this.parseUserId(req.user?.id);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    try {
      const result = await this.db.select({
        id: systemSessions.id,
        tokenId: systemSessions.tokenId,
        userAgent: systemSessions.userAgent,
        ipAddress: systemSessions.ipAddress,
        isRevoked: systemSessions.isRevoked,
        expiresAt: systemSessions.expiresAt,
        createdAt: systemSessions.createdAt,
        updatedAt: systemSessions.updatedAt
      })
      .from(systemSessions)
      .where(and(
        eq(systemSessions.userId, userId),
        eq(systemSessions.isRevoked, false),
        gt(systemSessions.expiresAt, new Date())
      ))
      .orderBy(sql`${systemSessions.createdAt} DESC`);

      const currentJti = String(req.user?.jti || '');
      const docs = Array.isArray(result)
        ? result.map((session: any) => ({ ...session, isCurrent: String(session.tokenId || '') === currentJti }))
        : [];
      return res.json({ docs, totalDocs: docs.length });
    } catch {
      return res.status(500).json({ error: 'Failed to load sessions' });
    }
  }

  async revokeMySession(req: any, res: Response) {
    const userId = this.parseUserId(req.user?.id);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const sessionId = String(req.params?.id || '').trim();
    if (!sessionId) return res.status(400).json({ error: 'Session id is required' });

    try {
      const match = await this.db.select({ id: systemSessions.id, tokenId: systemSessions.tokenId })
        .from(systemSessions)
        .where(and(eq(systemSessions.id, sessionId), eq(systemSessions.userId, userId)))
        .limit(1);
      const session = match?.[0];
      if (!session) return res.status(404).json({ error: 'Session not found' });

      await this.db.update(systemSessions)
        .set({ isRevoked: true, updatedAt: new Date() })
        .where(and(eq(systemSessions.id, sessionId), eq(systemSessions.userId, userId)));

      const currentJti = String(req.user?.jti || '');
      const revokedCurrent = String(session.tokenId || '') === currentJti;
      if (revokedCurrent) {
        this.clearAuthCookies(req as Request, res);
      }

      return res.json({ success: true, revokedCurrent });
    } catch {
      return res.status(500).json({ error: 'Failed to revoke session' });
    }
  }

  async revokeOtherSessions(req: any, res: Response) {
    const userId = this.parseUserId(req.user?.id);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    try {
      const currentJti = String(req.user?.jti || '');
      const revokedCount = await this.revokeOtherSessionsForUser(userId, currentJti);
      return res.json({ success: true, revokedCount });
    } catch {
      return res.status(500).json({ error: 'Failed to revoke sessions' });
    }
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

    const row = await this.db.select().from(users).where(eq(users.id, userId)).limit(1);
    const user = row?.[0];
    if (!user) return res.status(404).json({ error: 'User not found' });

    const oldEmail = this.normalizeEmail(user.email);
    if (oldEmail === newEmail) {
      return res.status(400).json({ error: 'New email must be different from current email' });
    }

    const passwordOk = await this.auth.comparePassword(currentPassword, String(user.password || ''));
    if (!passwordOk) {
      return res.status(400).json({ error: 'Current password is invalid' });
    }

    const existing = await this.db.select().from(users).where(eq(users.email, newEmail)).limit(1);
    if (existing?.[0]) {
      return res.status(409).json({ error: 'This email is already used by another account' });
    }

    const issued = await this.issueEmailChangeToken(userId, oldEmail, newEmail);
    const confirmUrl = await this.buildEmailChangeUrl(req, issued.token);
    const sent = await this.sendEmailChangeVerificationEmail({
      to: newEmail,
      confirmUrl,
      firstName: String(user.firstName || '').trim()
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

    const emailOwner = await this.db.select().from(users).where(eq(users.email, result.newEmail)).limit(1);
    if (emailOwner?.[0] && Number(emailOwner[0].id) !== result.userId) {
      return res.status(409).json({ error: 'This email is already used by another account' });
    }

    await this.db.update(users)
      .set({ email: result.newEmail, updatedAt: new Date() })
      .where(eq(users.id, result.userId));
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

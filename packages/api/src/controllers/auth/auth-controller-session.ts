import { Request, Response } from 'express';
import { SystemConstants } from '@fromcode119/core';
import { AuthControllerLifecycle } from './auth-controller-lifecycle';
import { AuthSessionRecordService } from './auth-session-record-service';

/**
 * Session listing/revocation handlers. Extracted from AuthControllerAccount to
 * keep each layer under the file-size limit; AuthControllerAccount extends this
 * class so the public (req,res) handlers remain on the same controller instance
 * with identical signatures/behavior.
 */
export class AuthControllerSession extends AuthControllerLifecycle {
  async logout(req: any, res: Response) {
    if (req.user && req.user.jti) {
      try {
        await this.db.update(SystemConstants.TABLE.SESSIONS, { tokenId: req.user.jti }, { isRevoked: true, updatedAt: new Date() });

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
      const sessions = await this.db.find(SystemConstants.TABLE.SESSIONS, {
        where: { isRevoked: false },
        orderBy: { createdAt: 'desc' },
        joins: [{
          table: SystemConstants.TABLE.USERS,
          on: { from: 'userId', to: 'id' },
          columns: ['email']
        }]
      });

      const now = new Date();
      res.json(
        AuthSessionRecordService
          .sortByCreatedAtDesc(sessions)
          .map((session: any) => AuthSessionRecordService.normalize(session))
          .filter((session: any) => AuthSessionRecordService.isActive(session, now)),
      );
    } catch {
      res.status(500).json({ error: 'Failed to fetch sessions' });
    }
  }

  async killSession(req: Request, res: Response) {
    const { id } = req.params;
    try {
      await this.db.update(SystemConstants.TABLE.SESSIONS, { id }, { isRevoked: true, updatedAt: new Date() });
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: 'Failed to kill session' });
    }
  }

  async getMySessions(req: any, res: Response) {
    const userId = this.parseUserId(req.user?.id);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    try {
      const sessions = await this.db.find(SystemConstants.TABLE.SESSIONS, { where: { userId, isRevoked: false } });
      const now = new Date();
      const currentJti = String(req.user?.jti || '');

      const docs = AuthSessionRecordService
        .sortByCreatedAtDesc(sessions)
        .map((session: any) => AuthSessionRecordService.normalize(session, currentJti))
        .filter((session: any) => AuthSessionRecordService.isActive(session, now));

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
      const match = await this.db.find(SystemConstants.TABLE.SESSIONS, { where: { id: sessionId, userId }, limit: 1 });
      const session = match?.[0];
      if (!session) return res.status(404).json({ error: 'Session not found' });

      await this.db.update(SystemConstants.TABLE.SESSIONS, { id: sessionId, userId }, { isRevoked: true, updatedAt: new Date() });

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
}

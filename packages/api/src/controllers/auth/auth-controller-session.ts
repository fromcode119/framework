import { Request, Response } from 'express';
import { TenantUserScope } from '@api/services/request/tenant-user-scope';
import { SystemConstants } from '@fromcode119/core';
import { AuthControllerLifecycle } from '@api/controllers/auth/auth-controller-lifecycle';
import { AuthSessionRecordService } from '@api/controllers/auth/auth-session-record-service';
import { CoercionUtils } from '@fromcode119/core';

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

  /**
   * Every active session — of THIS SITE's people.
   *
   * It used to be every active session on the platform, joined to `users` for the address: a site
   * administrator could read who was signed in across every other customer, from where, on what. The
   * account is what ties a session to a site, so the same membership scope that governs Users governs
   * this. A platform admin still sees the whole box, which is the point of the role.
   */
  async getSessions(req: Request, res: Response) {
    try {
      const scope = await TenantUserScope.of(req, this.db);
      // Filtered after the read, not in the WHERE: this query goes through the string-table path, whose
      // operator set is eq/ne/gt/gte/lt/lte — there is no `in`, and inventing one here would throw.
      // The read is the same one this endpoint always made, so nothing grew.
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
          .filter((session: any) => scope.allows(Number(session?.userId)))
          .map((session: any) => AuthSessionRecordService.normalize(session))
          .filter((session: any) => AuthSessionRecordService.isActive(session, now)),
      );
    } catch {
      res.status(500).json({ error: 'Failed to fetch sessions' });
    }
  }

  /**
   * Ends one session — but only one belonging to this site's people.
   *
   * The id was taken on trust and revoked with no ownership check at all, so an administrator of any
   * site could sign out every user of every other site by walking session ids. Refused as NOT FOUND:
   * "you may not kill session X" still confirms session X exists.
   */
  async killSession(req: Request, res: Response) {
    const { id } = req.params;
    try {
      const scope = await TenantUserScope.of(req, this.db);
      const match = await this.db.find(SystemConstants.TABLE.SESSIONS, { where: { id }, limit: 1 });
      const session = match?.[0];
      if (!session || !scope.allows(Number((session as any).userId))) {
        return res.status(404).json({ error: 'Session not found' });
      }
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
    const sessionId = CoercionUtils.toString(req.params?.id);
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

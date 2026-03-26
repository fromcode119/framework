/** ServerAuthSetup — configures auth validators and permission checker. Extracted from APIServer (ARC-007). */

import { Logger } from '@fromcode119/core';
import { SystemConstants } from '@fromcode119/core';
import { AuthManager, UserPermissionChecker } from '@fromcode119/auth';
import { systemSessions } from '@fromcode119/database';
import { createHash } from 'crypto';

export class ServerAuthSetup {
  constructor(
    private readonly auth: AuthManager,
    private readonly db: any,
    private readonly logger: Logger,
  ) {}

  configure() {
    this.auth.setPermissionChecker(new UserPermissionChecker(this.db));
    this.logger.info('Permission checker initialized and configured');

    this.auth.setSessionValidator(async (jti: string) => {
      try {
        const results = await this.db.find(systemSessions, {
          where: this.db.eq(systemSessions.tokenId, jti),
          limit: 1,
        });
        const session = results[0];
        if (!session) { this.logger.warn(`Session not found for JTI: ${jti}`); return false; }
        if (session.isRevoked) { this.logger.warn(`Session revoked for JTI: ${jti}`); return false; }
        if (!session.expiresAt) { this.logger.warn(`Session has no expiration for JTI: ${jti}`); return false; }
        const isValid = new Date(session.expiresAt) > new Date();
        if (!isValid) this.logger.warn(`Session expired for JTI: ${jti} (Expired at: ${session.expiresAt})`);
        return isValid;
      } catch (e) {
        this.logger.error(`Session validation error for JTI ${jti}: ${e}`);
        return false;
      }
    });

    this.auth.setApiKeyValidator(async (key: string) => {
      if (!key) return null;
      const rawKey = String(key || '').trim();
      if (!rawKey) return null;
      if (rawKey === process.env.MASTER_API_KEY) {
        return { id: '0', email: 'system@fromcode.com', roles: ['admin'] };
      }
      try {
        const keyHash = createHash('sha256').update(rawKey).digest('hex');
        const lookupRow = await this.db.findOne(SystemConstants.TABLE.META, { key: `auth:api_token:${keyHash}` });
        if (!lookupRow?.value) return null;
        let payload: any = null;
        try { payload = JSON.parse(String(lookupRow.value)); } catch { return null; }
        const userId = Number(payload?.userId || 0);
        const tokenId = String(payload?.tokenId || '').trim();
        if (!userId || !tokenId) return null;
        const expiresAt = payload?.expiresAt ? new Date(String(payload.expiresAt)) : null;
        if (expiresAt && !Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() < Date.now()) return null;
        const user = await this.db.findOne('users', { id: userId });
        if (!user) return null;
        const roles = Array.isArray(user.roles) ? user.roles : (() => {
          try { const p = JSON.parse(user.roles); return Array.isArray(p) ? p : []; } catch { return []; }
        })();
        return { id: String(user.id), email: String(user.email || ''), roles: roles.map((r: any) => String(r)), isApiKey: true, jti: `api:${tokenId}` };
      } catch (error) {
        this.logger.error(`API key validation failed: ${error}`);
        return null;
      }
    });
  }
}

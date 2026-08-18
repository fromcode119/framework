/** ServerAuthSetup — configures auth validators and permission checker. Extracted from APIServer (ARC-007). */

import { Logger } from '@fromcode119/core';
import { SystemConstants, ApiAccessGate } from '@fromcode119/core';
import { AuthManager, UserPermissionChecker } from '@fromcode119/auth';
import { Schema } from '@fromcode119/database';
import { createHash } from 'crypto';

export class ServerAuthSetup {
  constructor(
    private readonly auth: AuthManager,
    private readonly db: any,
    private readonly logger: Logger,
  ) {}

  configure() {
    const permissionChecker = new UserPermissionChecker(this.db);
    this.auth.setPermissionChecker(permissionChecker);
    // Wire the same checker into the central plugin-route access gate so `{ access: { permission } }`
    // declarations can be enforced once ENFORCE_AUTHZ_GATEWAY is enabled.
    ApiAccessGate.setPermissionChecker((userId, permission) => permissionChecker.hasPermission(userId, permission));
    this.logger.info('Permission checker initialized and configured');

    this.auth.setSessionValidator(async (jti: string) => {
      try {
        const results = await this.db.find(Schema.systemSessions, {
          where: this.db.eq(Schema.systemSessions.tokenId, jti),
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

    // Every API key resolves through the token record below — one code path, so a key always has an
    // owner, an expiry and a revocation point. The `MASTER_API_KEY` env branch that used to sit here
    // was the ORIGINAL PLACEHOLDER for this validator ("In a real app, you'd check a table of API
    // keys", d54ab26): it returned a synthetic `roles: ['admin']` user with no record, no expiry and
    // nothing to revoke. The real table-backed check landed underneath it and the stub was never
    // removed, leaving a full-admin bypass that no admin screen could show and that nothing could
    // scope. It was unset in production, so deleting it changes no running behaviour.
    this.auth.setApiKeyValidator(async (key: string) => {
      if (!key) return null;
      const rawKey = String(key || '').trim();
      if (!rawKey) return null;
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
        // Carried through so the MCP surface can narrow this token to a subset of tools. Left
        // `undefined` when the token predates scopes, which the matcher reads as "not narrowed" —
        // so existing tokens keep working exactly as before.
        // NOT filtered here on purpose: `McpTokenScopeMatcher` distinguishes "no list" (unrestricted)
        // from "a list that narrows to nothing usable" (deny). Dropping blanks at this layer would
        // collapse the second case into the first and silently unrestrict a malformed token.
        const mcpScopes = Array.isArray(payload?.scopes)
          ? payload.scopes.map((s: any) => String(s || ''))
          : undefined;
        return {
          id: String(user.id),
          email: String(user.email || ''),
          roles: roles.map((r: any) => String(r)),
          isApiKey: true,
          jti: `api:${tokenId}`,
          mcpScopes,
        };
      } catch (error) {
        this.logger.error(`API key validation failed: ${error}`);
        return null;
      }
    });
  }
}

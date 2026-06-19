import { randomBytes } from 'crypto';
import { SystemConstants } from '@fromcode119/core';
import { AuthControllerEmailVerification } from './auth-controller-email-verification';
import type { ApiTokenRecord } from './auth-controller.interfaces';

export class AuthControllerTokenSupport extends AuthControllerEmailVerification {
  protected getPasswordResetTokenHashKey(userId: number) {
    return `user:${userId}:password_reset_token_hash`;
  }

  protected getPasswordResetTokenKey(tokenHash: string) {
    return `auth:password_reset_token:${tokenHash}`;
  }

  protected async issuePasswordResetToken(userId: number, email: string): Promise<{ token: string; expiresAt: Date }> {
    const token = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(token);
    const ttlMinutes = await this.getSettingNumber(SystemConstants.META_KEY.AUTH_PASSWORD_RESET_TOKEN_MINUTES, this.defaultPasswordResetExpiryMinutes, 5, 1440);
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

    const previousHash = String((await this.getMetaValue(this.getPasswordResetTokenHashKey(userId))) || '').trim();
    if (previousHash && previousHash !== tokenHash) {
      await this.deleteMeta(this.getPasswordResetTokenKey(previousHash));
    }

    await this.upsertMeta(this.getPasswordResetTokenKey(tokenHash), JSON.stringify({
      userId,
      email,
      expiresAt: expiresAt.toISOString()
    }));
    await this.upsertMeta(this.getPasswordResetTokenHashKey(userId), tokenHash);

    return { token, expiresAt };
  }

  protected async consumePasswordResetToken(token: string): Promise<{ ok: boolean; reason?: 'invalid' | 'expired'; userId?: number; email?: string }> {
    const tokenHash = this.hashToken(token);
    const tokenKey = this.getPasswordResetTokenKey(tokenHash);
    const row = await this.readMetaRow(tokenKey);
    if (!row?.value) return { ok: false, reason: 'invalid' };

    let payload: any;
    try {
      payload = JSON.parse(String(row.value));
    } catch {
      return { ok: false, reason: 'invalid' };
    }

    const userId = Number(payload?.userId || 0);
    const email = this.normalizeEmail(payload?.email);
    const expiresAt = new Date(String(payload?.expiresAt || 0));
    if (!userId || !email || Number.isNaN(expiresAt.getTime())) {
      return { ok: false, reason: 'invalid' };
    }

    if (expiresAt.getTime() < Date.now()) {
      await this.deleteMeta(tokenKey);
      await this.deleteMeta(this.getPasswordResetTokenHashKey(userId));
      return { ok: false, reason: 'expired' };
    }

    await this.deleteMeta(tokenKey);
    await this.deleteMeta(this.getPasswordResetTokenHashKey(userId));
    return { ok: true, userId, email };
  }

  protected getEmailChangeTokenHashKey(userId: number) {
    return `user:${userId}:email_change_token_hash`;
  }

  protected getEmailChangeTokenKey(tokenHash: string) {
    return `auth:email_change_token:${tokenHash}`;
  }

  protected async issueEmailChangeToken(userId: number, oldEmail: string, newEmail: string): Promise<{ token: string; expiresAt: Date }> {
    const token = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(token);
    const ttlMinutes = await this.getSettingNumber(SystemConstants.META_KEY.AUTH_EMAIL_CHANGE_TOKEN_MINUTES, this.defaultEmailChangeExpiryMinutes, 10, 1440);
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

    const previousHash = String((await this.getMetaValue(this.getEmailChangeTokenHashKey(userId))) || '').trim();
    if (previousHash && previousHash !== tokenHash) {
      await this.deleteMeta(this.getEmailChangeTokenKey(previousHash));
    }

    await this.upsertMeta(this.getEmailChangeTokenKey(tokenHash), JSON.stringify({
      userId,
      oldEmail,
      newEmail,
      expiresAt: expiresAt.toISOString()
    }));
    await this.upsertMeta(this.getEmailChangeTokenHashKey(userId), tokenHash);
    return { token, expiresAt };
  }

  protected async consumeEmailChangeToken(token: string): Promise<{ ok: boolean; reason?: 'invalid' | 'expired'; userId?: number; oldEmail?: string; newEmail?: string }> {
    const tokenHash = this.hashToken(token);
    const tokenKey = this.getEmailChangeTokenKey(tokenHash);
    const row = await this.readMetaRow(tokenKey);
    if (!row?.value) return { ok: false, reason: 'invalid' };

    let payload: any;
    try {
      payload = JSON.parse(String(row.value));
    } catch {
      return { ok: false, reason: 'invalid' };
    }

    const userId = Number(payload?.userId || 0);
    const oldEmail = this.normalizeEmail(payload?.oldEmail);
    const newEmail = this.normalizeEmail(payload?.newEmail);
    const expiresAt = new Date(String(payload?.expiresAt || 0));
    if (!userId || !oldEmail || !newEmail || Number.isNaN(expiresAt.getTime())) {
      return { ok: false, reason: 'invalid' };
    }

    if (expiresAt.getTime() < Date.now()) {
      await this.deleteMeta(tokenKey);
      await this.deleteMeta(this.getEmailChangeTokenHashKey(userId));
      return { ok: false, reason: 'expired' };
    }

    await this.deleteMeta(tokenKey);
    await this.deleteMeta(this.getEmailChangeTokenHashKey(userId));
    return { ok: true, userId, oldEmail, newEmail };
  }

  protected getApiTokensKey(userId: number) {
    return `user:${userId}:api_tokens`;
  }

  protected getApiTokenLookupKey(tokenHash: string) {
    return `auth:api_token:${tokenHash}`;
  }

  protected async readApiTokenRecords(userId: number): Promise<ApiTokenRecord[]> {
    const row = await this.readMetaRow(this.getApiTokensKey(userId));
    if (!row?.value) return [];
    try {
      const parsed = JSON.parse(String(row.value));
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map((entry: any) => ({
          id: String(entry?.id || '').trim(),
          name: String(entry?.name || '').trim() || 'Token',
          hash: String(entry?.hash || '').trim(),
          prefix: String(entry?.prefix || '').trim(),
          scopes: Array.isArray(entry?.scopes) ? entry.scopes.map((s: any) => String(s || '').trim()).filter(Boolean) : [],
          createdAt: String(entry?.createdAt || '').trim() || new Date().toISOString(),
          createdByIp: entry?.createdByIp ? String(entry.createdByIp) : undefined,
          expiresAt: entry?.expiresAt ? String(entry.expiresAt) : null,
          revokedAt: entry?.revokedAt ? String(entry.revokedAt) : null,
          lastUsedAt: entry?.lastUsedAt ? String(entry.lastUsedAt) : null
        }))
        .filter((entry: ApiTokenRecord) => !!entry.id && !!entry.hash);
    } catch {
      return [];
    }
  }

  protected async writeApiTokenRecords(userId: number, records: ApiTokenRecord[]) {
    await this.upsertMeta(this.getApiTokensKey(userId), JSON.stringify(records));
  }

  protected async revokeAllSessionsForUser(userId: number) {
    await this.db.update(SystemConstants.TABLE.SESSIONS, { userId, isRevoked: false }, { isRevoked: true, updatedAt: new Date() });
  }

  protected async revokeOtherSessionsForUser(userId: number, currentJti: string): Promise<number> {
    const activeSessions = await this.db.find(SystemConstants.TABLE.SESSIONS, { where: { userId, isRevoked: false } });

    const targetIds = activeSessions
      .filter((row: any) => String(row?.tokenId || '') !== String(currentJti || ''))
      .map((row: any) => String(row.id));

    for (const id of targetIds) {
      await this.db.update(SystemConstants.TABLE.SESSIONS, { id }, { isRevoked: true, updatedAt: new Date() });
    }

    return targetIds.length;
  }

  protected async getConfiguredSsoProviders(): Promise<string[]> {
    try {
      const integration = await (this.manager.integrations as any).getConfig('sso');
      const storedProviders = Array.isArray(integration?.storedProviders) ? integration.storedProviders : [];
      const enabled = storedProviders
        .filter((entry: any) => entry && entry.enabled !== false)
        .map((entry: any) => String(entry.providerKey || '').trim().toLowerCase())
        .filter(Boolean);
      if (enabled.length > 0) {
        return Array.from(new Set(enabled));
      }

      const active = String(integration?.active?.provider || '').trim().toLowerCase();
      if (active) return [active];
    } catch {
      // Fall back to legacy metadata-based configuration.
    }

    const raw = String((await this.getMetaValue('auth_sso_providers')) || '').trim();
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.map((item: any) => String(item || '').trim().toLowerCase()).filter(Boolean);
    } catch {
      return raw.split(',').map((part) => part.trim().toLowerCase()).filter(Boolean);
    }
  }

}



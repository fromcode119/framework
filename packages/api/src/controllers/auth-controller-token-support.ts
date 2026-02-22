import { randomBytes } from 'crypto';
import * as speakeasy from 'speakeasy';
import { eq, and, systemSessions } from '@fromcode/database';
import { AuthControllerPolicy } from './auth-controller-policy';
import type { ApiTokenRecord } from './auth-controller-types';

export class AuthControllerTokenSupport extends AuthControllerPolicy {
  protected getPasswordResetTokenHashKey(userId: number) {
    return `user:${userId}:password_reset_token_hash`;
  }

  protected getPasswordResetTokenKey(tokenHash: string) {
    return `auth:password_reset_token:${tokenHash}`;
  }

  protected async issuePasswordResetToken(userId: number, email: string): Promise<{ token: string; expiresAt: Date }> {
    const token = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(token);
    const ttlMinutes = await this.getSettingNumber('auth_password_reset_token_minutes', this.defaultPasswordResetExpiryMinutes, 5, 1440);
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
    const ttlMinutes = await this.getSettingNumber('auth_email_change_token_minutes', this.defaultEmailChangeExpiryMinutes, 10, 1440);
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
    await this.db.update(systemSessions)
      .set({ isRevoked: true, updatedAt: new Date() })
      .where(and(eq(systemSessions.userId, userId), eq(systemSessions.isRevoked, false)));
  }

  protected async revokeOtherSessionsForUser(userId: number, currentJti: string): Promise<number> {
    const activeSessions = await this.db.select({ id: systemSessions.id, tokenId: systemSessions.tokenId })
      .from(systemSessions)
      .where(and(eq(systemSessions.userId, userId), eq(systemSessions.isRevoked, false)));

    const targetIds = activeSessions
      .filter((row: any) => String(row?.tokenId || '') !== String(currentJti || ''))
      .map((row: any) => String(row.id));

    for (const id of targetIds) {
      await this.db.update(systemSessions)
        .set({ isRevoked: true, updatedAt: new Date() })
        .where(eq(systemSessions.id, id));
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

  protected verifyTOTP(secret: string, token: string): boolean {
    try {
      return speakeasy.totp.verify({
        secret,
        encoding: 'base32',
        token,
        window: 1
      });
    } catch (e) {
      console.error('[AuthController] TOTP verification failed:', e);
      return false;
    }
  }

  protected getRecoveryCodesKey(userId: number) {
    return `user:${userId}:2fa_recovery_codes`;
  }

  protected getEmailVerifiedKey(userId: number) {
    return `user:${userId}:email_verified`;
  }

  protected getEmailVerifyTokenHashKey(userId: number) {
    return `user:${userId}:email_verify_token_hash`;
  }

  protected getEmailVerifyTokenExpiresKey(userId: number) {
    return `user:${userId}:email_verify_token_expires_at`;
  }

  protected getEmailVerifyTokenKey(tokenHash: string) {
    return `auth:verify_email_token:${tokenHash}`;
  }

  protected async setEmailVerified(userId: number, verified: boolean) {
    await this.upsertMeta(this.getEmailVerifiedKey(userId), verified ? 'true' : 'false');
  }

  protected async isEmailVerified(userId: number): Promise<boolean> {
    const row = await this.readMetaRow(this.getEmailVerifiedKey(userId));
    if (!row) return true;
    return String(row.value || '').trim().toLowerCase() === 'true';
  }

  protected async requiresEmailVerification(userId: number): Promise<boolean> {
    const row = await this.readMetaRow(this.getEmailVerifiedKey(userId));
    if (!row) return false;
    return String(row.value || '').trim().toLowerCase() !== 'true';
  }

  protected async issueEmailVerificationToken(
    userId: number,
    email: string,
    context?: Record<string, any>
  ): Promise<{ token: string; expiresAt: Date }> {
    const token = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const previousTokenHash = String((await this.getMetaValue(this.getEmailVerifyTokenHashKey(userId))) || '').trim();
    if (previousTokenHash && previousTokenHash !== tokenHash) {
      await this.deleteMeta(this.getEmailVerifyTokenKey(previousTokenHash));
    }

    const payload = {
      userId,
      email,
      expiresAt: expiresAt.toISOString(),
      context: context && Object.keys(context).length ? context : undefined
    };

    await this.upsertMeta(this.getEmailVerifyTokenKey(tokenHash), JSON.stringify(payload));
    await this.upsertMeta(this.getEmailVerifyTokenHashKey(userId), tokenHash);
    await this.upsertMeta(this.getEmailVerifyTokenExpiresKey(userId), expiresAt.toISOString());
    await this.setEmailVerified(userId, false);

    return { token, expiresAt };
  }

  protected async consumeEmailVerificationToken(token: string): Promise<{
    ok: boolean;
    reason?: 'invalid' | 'expired';
    userId?: number;
    email?: string;
    context?: Record<string, any>;
  }> {
    const tokenHash = this.hashToken(token);
    const tokenKey = this.getEmailVerifyTokenKey(tokenHash);
    const row = await this.readMetaRow(tokenKey);
    if (!row?.value) {
      return { ok: false, reason: 'invalid' };
    }

    let payload: any = null;
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
      await this.deleteMeta(this.getEmailVerifyTokenHashKey(userId));
      await this.deleteMeta(this.getEmailVerifyTokenExpiresKey(userId));
      return { ok: false, reason: 'expired' };
    }

    await this.setEmailVerified(userId, true);
    await this.deleteMeta(tokenKey);
    await this.deleteMeta(this.getEmailVerifyTokenHashKey(userId));
    await this.deleteMeta(this.getEmailVerifyTokenExpiresKey(userId));

    return {
      ok: true,
      userId,
      email,
      context: payload?.context && typeof payload.context === 'object' ? payload.context : undefined
    };
  }

  protected async consumeRecoveryCode(userId: number, code: string): Promise<boolean> {
    const row = await this.readMetaRow(this.getRecoveryCodesKey(userId));
    const raw = String(row?.value || '').trim();
    if (!raw) return false;

    let records: Array<{ hash: string; usedAt?: string | null; createdAt?: string }> = [];
    try {
      const parsed = JSON.parse(raw);
      records = Array.isArray(parsed) ? parsed : [];
    } catch {
      return false;
    }

    const targetHash = this.hashRecoveryCode(code);
    const targetIndex = records.findIndex((entry) => entry?.hash === targetHash && !entry?.usedAt);
    if (targetIndex < 0) return false;

    records.splice(targetIndex, 1);
    await this.upsertMeta(this.getRecoveryCodesKey(userId), JSON.stringify(records));
    return true;
  }
}

export type { ApiTokenRecord };

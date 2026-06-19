import * as speakeasy from 'speakeasy';
import type { Request, Response } from 'express';
import { randomBytes } from 'crypto';
import { SystemConstants, SecretService } from '@fromcode119/core';
import { AuthControllerPolicy } from './auth-controller-policy';

/**
 * Email-verification tokens, 2FA recovery codes, and the non-password 2FA
 * challenge. Extracted from AuthControllerTokenSupport to keep each layer under
 * the file-size limit; AuthControllerTokenSupport extends this class so all
 * protected helpers remain available unchanged across the controller chain.
 */
export class AuthControllerEmailVerification extends AuthControllerPolicy {
  protected verifyTOTP(secret: string, token: string): boolean {
    try {
      return speakeasy.totp.verify({
        secret,
        encoding: 'base32',
        token,
        window: 1
      });
    } catch (e) {
      this.logger.error(`[AuthController] TOTP verification failed: ${e}`);
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

  /**
   * Enforces an account's app-level 2FA on a non-password login path (SSO).
   * Mirrors the password login challenge: when 2FA is enabled and no token was
   * provided, responds with `requiresTwoFactor` so the client re-submits with
   * `totpToken`/`recoveryCode`; on a bad token responds 401.
   * Returns true when the caller may issue the session; false when a response
   * has already been sent.
   */
  protected async enforceTwoFactorChallenge(req: Request, res: Response, user: any): Promise<boolean> {
    const twoFactorMeta = await this.db.findOne(SystemConstants.TABLE.META, {
      key: `user:${user.id}:2fa_enabled`
    });
    if (twoFactorMeta?.value !== 'true') return true;

    const totpToken = String(req.body?.totpToken || '').trim();
    const recoveryCode = String(req.body?.recoveryCode || '').trim();

    if (!totpToken && !recoveryCode) {
      res.status(200).json({
        requiresTwoFactor: true,
        message: 'Please provide your 2FA token or recovery code'
      });
      return false;
    }

    let verified = false;
    let method: 'totp' | 'recovery' | null = null;

    if (totpToken) {
      const secretRow = await this.db.findOne(SystemConstants.TABLE.META, {
        key: `user:${user.id}:totp_secret`
      });
      if (secretRow?.value && this.verifyTOTP(SecretService.decrypt(secretRow.value), totpToken)) {
        verified = true;
        method = 'totp';
      }
    }

    if (!verified && recoveryCode) {
      if (await this.consumeRecoveryCode(user.id, recoveryCode)) {
        verified = true;
        method = 'recovery';
      }
    }

    if (!verified) {
      await this.manager.writeLog(
        'WARN',
        `Failed 2FA attempt for ${user.email}`,
        'system',
        { userId: user.id, ip: req.ip }
      ).catch(() => {});
      res.status(401).json({ error: 'Invalid 2FA token or recovery code' });
      return false;
    }

    await this.manager.writeLog(
      'INFO',
      `Successful 2FA challenge (${method}) for ${user.email}`,
      'system',
      { userId: user.id, email: user.email, ip: req.ip, method }
    ).catch(() => {});
    return true;
  }
}

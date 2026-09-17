/** SystemTwoFactorService — 2FA management endpoints. Extracted from SystemController (ARC-007). */
import { Request, Response } from 'express';
import Handlebars from 'handlebars';
import { promises as fs } from 'fs';
import path from 'path';
import { ApplicationUrlUtils, FrameworkEmailSenderService, Logger, SystemConstants, SecretService } from '@fromcode119/core';
import type { FrameworkEmailSender } from '@fromcode119/core';
import { createHash, randomBytes } from 'crypto';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import { Schema } from '@fromcode119/database';
import { AuthUtils } from '@api/utils/auth';
import { UserManagementService } from '@api/services/user-management-service';
import { RequestParamUtils } from '@api/utils/request-param-utils';
import { TwoFactorRecoveryCodes } from '@api/controllers/system/two-factor-recovery-codes';

export class SystemTwoFactorService {
  private readonly logger = new Logger({ namespace: 'System2FA' });

  private readonly recovery: TwoFactorRecoveryCodes;

  constructor(
    private readonly db: any,
    private readonly emailGetter: () => { send: (opts: any) => Promise<any> },
    private readonly users: UserManagementService,
    /** Reads the operator-configured sender — see {@link FrameworkEmailSenderService}. */
    private readonly integrations: { getConfig(type: string): Promise<any> },
  ) {
    this.recovery = new TwoFactorRecoveryCodes(db, this.logger, integrations, emailGetter);
  }

  async getTwoFactorStatus(req: Request, res: Response) {
    try {
      const userId = RequestParamUtils.relationId(req, res, 'user');
      if (userId === null) return;
      res.json(await this.getStatusForUser(userId));
    } catch (e: any) { res.status(this.resolveErrorStatus(e)).json({ error: e.message }); }
  }

  async setup2FA(req: Request, res: Response) {
    try {
      const userId = RequestParamUtils.relationId(req, res, 'user');
      if (userId === null) return;
      res.json(await this.setupForUser(userId));
    } catch (e: any) { res.status(this.resolveErrorStatus(e)).json({ error: e.message }); }
  }

  async verify2FA(req: Request, res: Response) {
    try {
      const userId = RequestParamUtils.relationId(req, res, 'user');
      if (userId === null) return;
      const { token } = req.body;
      if (!token) return res.status(400).json({ error: 'Token is required' });
      res.json(await this.verifyForUser(userId, String(token)));
    } catch (e: any) { res.status(this.resolveErrorStatus(e)).json({ error: e.message }); }
  }

  async regenerateRecoveryCodes(req: Request, res: Response) {
    try {
      const userId = RequestParamUtils.relationId(req, res, 'user');
      if (userId === null) return;
      res.json(await this.regenerateRecoveryCodesForUser(userId));
    } catch (e: any) { res.status(this.resolveErrorStatus(e)).json({ error: e.message }); }
  }

  async disable2FA(req: Request, res: Response) {
    try {
      const userId = RequestParamUtils.relationId(req, res, 'user');
      if (userId === null) return;
      res.json(await this.disableForUser(userId));
    } catch (e: any) { res.status(this.resolveErrorStatus(e)).json({ error: e.message }); }
  }

  async getStatusForUser(userId: number): Promise<{ enabled: boolean; recoveryCodesRemaining: number }> {
    const enabledRow = await this.db.findOne(SystemConstants.TABLE.META, { key: `user:${userId}:2fa_enabled` });
    const recoveryCodes = await this.readRecoveryCodeRecords(userId);
    return {
      enabled: enabledRow?.value === 'true',
      recoveryCodesRemaining: recoveryCodes.filter((entry) => !entry.usedAt).length,
    };
  }

  async setupForUser(userId: number): Promise<{ secret: string; qrCode: string }> {
    // Honor the platform `two_factor_enabled` toggle (admin Settings → Security). When it is explicitly
    // off, new 2FA enrolment is refused — the global switch was previously persisted but never enforced.
    // Existing 2FA users are unaffected (verify/disable still work); only NEW setup is gated.
    const globalToggle = await this.db.findOne(SystemConstants.TABLE.META, { key: SystemConstants.META_KEY.TWO_FACTOR_ENABLED });
    if (globalToggle && String(globalToggle.value).trim().toLowerCase() === 'false') {
      throw new Error('Two-factor authentication is disabled by the administrator.');
    }

    const user = await this.users.getUser(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const issuer = await this.recovery.resolveFrameworkAppName();
    const secret = speakeasy.generateSecret({ name: `${issuer} (${user.email})`, length: 32 });
    const qrCode = await QRCode.toDataURL(secret.otpauth_url!);
    const key = `user:${userId}:totp_secret_pending`;
    const encryptedSecret = SecretService.encrypt(secret.base32);
    const existingSecret = await this.db.findOne(SystemConstants.TABLE.META, { key });
    if (existingSecret) {
      await this.db.update(SystemConstants.TABLE.META, { key }, { value: encryptedSecret });
    } else {
      await this.db.insert(SystemConstants.TABLE.META, { key, value: encryptedSecret });
    }

    return { secret: secret.base32, qrCode };
  }

  async verifyForUser(userId: number, token: string): Promise<{ success: true; message: string; recoveryCodes: string[] }> {
    const secretRow = await this.db.findOne(SystemConstants.TABLE.META, { key: `user:${userId}:totp_secret_pending` });
    if (!secretRow) {
      throw new Error('2FA setup not initiated. Please start setup first.');
    }

    const totpSecret = SecretService.decrypt(secretRow.value);
    const verified = speakeasy.totp.verify({ secret: totpSecret, encoding: 'base32', token, window: 1 });
    if (!verified) {
      throw new Error('Invalid verification code');
    }

    await this.upsertMetaValue(`user:${userId}:totp_secret`, secretRow.value);
    await this.upsertMetaValue(`user:${userId}:2fa_enabled`, 'true');
    const recoveryCodes = this.generateRecoveryCodes();
    await this.writeRecoveryCodeRecords(userId, recoveryCodes.map((code) => ({ hash: this.hashRecoveryCode(code), usedAt: null, createdAt: new Date().toISOString() })));
    await this.db.delete(SystemConstants.TABLE.META, { key: `user:${userId}:totp_secret_pending` });
    await this.sendSecurityNotification({ userId, subject: 'Two-factor authentication enabled', title: 'Two-factor authentication has been enabled on your account.', details: [`Time: ${new Date().toISOString()}`] });
    return { success: true, message: '2FA enabled successfully', recoveryCodes };
  }

  async regenerateRecoveryCodesForUser(userId: number): Promise<{ success: true; recoveryCodes: string[] }> {
    const enabledRow = await this.db.findOne(SystemConstants.TABLE.META, { key: `user:${userId}:2fa_enabled` });
    if (enabledRow?.value !== 'true') {
      throw new Error('2FA must be enabled before recovery codes can be generated.');
    }

    const recoveryCodes = this.generateRecoveryCodes();
    await this.writeRecoveryCodeRecords(userId, recoveryCodes.map((code) => ({ hash: this.hashRecoveryCode(code), usedAt: null, createdAt: new Date().toISOString() })));
    return { success: true, recoveryCodes };
  }

  async disableForUser(userId: number): Promise<{ success: true; message: string }> {
    await this.db.delete(SystemConstants.TABLE.META, { key: `user:${userId}:2fa_enabled` });
    await this.db.delete(SystemConstants.TABLE.META, { key: `user:${userId}:totp_secret` });
    await this.db.delete(SystemConstants.TABLE.META, { key: `user:${userId}:totp_secret_pending` });
    await this.db.delete(SystemConstants.TABLE.META, { key: this.recovery.getRecoveryCodesKey(userId) });
    await this.sendSecurityNotification({ userId, subject: 'Two-factor authentication disabled', title: 'Two-factor authentication has been disabled on your account.', details: [`Time: ${new Date().toISOString()}`] });
    return { success: true, message: '2FA disabled successfully' };
  }

  /**
   * Prove possession before a sensitive self-service change (e.g. turning 2FA off): a CURRENT
   * code from the ACTIVE secret, or an unused recovery code (consumed on success). Without this,
   * anyone holding an unlocked signed-in device could silently strip the account's second factor.
   * No-op when 2FA is not enabled.
   */
  async assertActiveToken(userId: number, token: string): Promise<void> {
    const enabledRow = await this.db.findOne(SystemConstants.TABLE.META, { key: `user:${userId}:2fa_enabled` });
    if (enabledRow?.value !== 'true') return;
    const clean = String(token || '').trim();
    if (!clean) throw new Error('Your current 6-digit code is required.');
    const secretRow = await this.db.findOne(SystemConstants.TABLE.META, { key: `user:${userId}:totp_secret` });
    if (secretRow) {
      const totpSecret = SecretService.decrypt(secretRow.value);
      if (speakeasy.totp.verify({ secret: totpSecret, encoding: 'base32', token: clean, window: 1 })) return;
    }
    // Recovery-code fallback — a valid unused code is consumed so it can't be replayed.
    const records = await this.readRecoveryCodeRecords(userId);
    const hash = this.hashRecoveryCode(clean);
    const hit = records.find((r) => !r.usedAt && r.hash === hash);
    if (hit) {
      hit.usedAt = new Date().toISOString();
      await this.writeRecoveryCodeRecords(userId, records);
      return;
    }
    throw new Error('That code didn’t work — use the current one from your authenticator, or a recovery code.');
  }

  /** @see TwoFactorRecoveryCodes.generateRecoveryCodes */
  generateRecoveryCodes(...args: Parameters<TwoFactorRecoveryCodes["generateRecoveryCodes"]>): ReturnType<TwoFactorRecoveryCodes["generateRecoveryCodes"]> {
    return this.recovery.generateRecoveryCodes(...args);
  }

  /** @see TwoFactorRecoveryCodes.hashRecoveryCode */
  hashRecoveryCode(...args: Parameters<TwoFactorRecoveryCodes["hashRecoveryCode"]>): ReturnType<TwoFactorRecoveryCodes["hashRecoveryCode"]> {
    return this.recovery.hashRecoveryCode(...args);
  }

  /** @see TwoFactorRecoveryCodes.readRecoveryCodeRecords */
  readRecoveryCodeRecords(...args: Parameters<TwoFactorRecoveryCodes["readRecoveryCodeRecords"]>): ReturnType<TwoFactorRecoveryCodes["readRecoveryCodeRecords"]> {
    return this.recovery.readRecoveryCodeRecords(...args);
  }

  /** @see TwoFactorRecoveryCodes.writeRecoveryCodeRecords */
  writeRecoveryCodeRecords(...args: Parameters<TwoFactorRecoveryCodes["writeRecoveryCodeRecords"]>): ReturnType<TwoFactorRecoveryCodes["writeRecoveryCodeRecords"]> {
    return this.recovery.writeRecoveryCodeRecords(...args);
  }

  /** @see TwoFactorRecoveryCodes.upsertMetaValue */
  upsertMetaValue(...args: Parameters<TwoFactorRecoveryCodes["upsertMetaValue"]>): ReturnType<TwoFactorRecoveryCodes["upsertMetaValue"]> {
    return this.recovery.upsertMetaValue(...args);
  }

  /** @see TwoFactorRecoveryCodes.getMetaValue */
  getMetaValue(...args: Parameters<TwoFactorRecoveryCodes["getMetaValue"]>): ReturnType<TwoFactorRecoveryCodes["getMetaValue"]> {
    return this.recovery.getMetaValue(...args);
  }

  /** @see TwoFactorRecoveryCodes.sendSecurityNotification */
  sendSecurityNotification(...args: Parameters<TwoFactorRecoveryCodes["sendSecurityNotification"]>): ReturnType<TwoFactorRecoveryCodes["sendSecurityNotification"]> {
    return this.recovery.sendSecurityNotification(...args);
  }

  /** @see TwoFactorRecoveryCodes.resolveErrorStatus */
  resolveErrorStatus(...args: Parameters<TwoFactorRecoveryCodes["resolveErrorStatus"]>): ReturnType<TwoFactorRecoveryCodes["resolveErrorStatus"]> {
    return this.recovery.resolveErrorStatus(...args);
  }

}

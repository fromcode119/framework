/** SystemTwoFactorService — 2FA management endpoints. Extracted from SystemController (ARC-007). */

import { Request, Response } from 'express';
import { SystemConstants } from '@fromcode119/core';
import { createHash, randomBytes } from 'crypto';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import { users } from '@fromcode119/database';
import { AuthUtils } from '../../utils/auth';
import { UserManagementService } from '../../services/user-management-service';

export class SystemTwoFactorService {
  constructor(
    private readonly db: any,
    private readonly emailGetter: () => { send: (opts: any) => Promise<any> },
    private readonly users: UserManagementService,
  ) {}

  async getTwoFactorStatus(req: Request, res: Response) {
    try {
      const userId = parseInt(req.params.id, 10);
      if (Number.isNaN(userId)) return res.status(400).json({ error: 'Invalid user id' });
      res.json(await this.getStatusForUser(userId));
    } catch (e: any) { res.status(this.resolveErrorStatus(e)).json({ error: e.message }); }
  }

  async setup2FA(req: Request, res: Response) {
    try {
      const userId = parseInt(req.params.id, 10);
      if (Number.isNaN(userId)) return res.status(400).json({ error: 'Invalid user id' });
      res.json(await this.setupForUser(userId));
    } catch (e: any) { res.status(this.resolveErrorStatus(e)).json({ error: e.message }); }
  }

  async verify2FA(req: Request, res: Response) {
    try {
      const userId = parseInt(req.params.id, 10);
      if (Number.isNaN(userId)) return res.status(400).json({ error: 'Invalid user id' });
      const { token } = req.body;
      if (!token) return res.status(400).json({ error: 'Token is required' });
      res.json(await this.verifyForUser(userId, String(token)));
    } catch (e: any) { res.status(this.resolveErrorStatus(e)).json({ error: e.message }); }
  }

  async regenerateRecoveryCodes(req: Request, res: Response) {
    try {
      const userId = parseInt(req.params.id, 10);
      if (Number.isNaN(userId)) return res.status(400).json({ error: 'Invalid user id' });
      res.json(await this.regenerateRecoveryCodesForUser(userId));
    } catch (e: any) { res.status(this.resolveErrorStatus(e)).json({ error: e.message }); }
  }

  async disable2FA(req: Request, res: Response) {
    try {
      const userId = parseInt(req.params.id, 10);
      if (Number.isNaN(userId)) return res.status(400).json({ error: 'Invalid user id' });
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
    const user = await this.users.getUser(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const secret = speakeasy.generateSecret({ name: `Fromcode (${user.email})`, length: 32 });
    const qrCode = await QRCode.toDataURL(secret.otpauth_url!);
    const key = `user:${userId}:totp_secret_pending`;
    const existingSecret = await this.db.findOne(SystemConstants.TABLE.META, { key });
    if (existingSecret) {
      await this.db.update(SystemConstants.TABLE.META, { key }, { value: secret.base32 });
    } else {
      await this.db.insert(SystemConstants.TABLE.META, { key, value: secret.base32 });
    }

    return { secret: secret.base32, qrCode };
  }

  async verifyForUser(userId: number, token: string): Promise<{ success: true; message: string; recoveryCodes: string[] }> {
    const secretRow = await this.db.findOne(SystemConstants.TABLE.META, { key: `user:${userId}:totp_secret_pending` });
    if (!secretRow) {
      throw new Error('2FA setup not initiated. Please start setup first.');
    }

    const verified = speakeasy.totp.verify({ secret: secretRow.value, encoding: 'base32', token, window: 1 });
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
    await this.db.delete(SystemConstants.TABLE.META, { key: this.getRecoveryCodesKey(userId) });
    await this.sendSecurityNotification({ userId, subject: 'Two-factor authentication disabled', title: 'Two-factor authentication has been disabled on your account.', details: [`Time: ${new Date().toISOString()}`] });
    return { success: true, message: '2FA disabled successfully' };
  }

  private getRecoveryCodesKey(userId: number) { return `user:${userId}:2fa_recovery_codes`; }

  private generateRecoveryCodes(count: number = 10): string[] {
    const codes: string[] = [];
    while (codes.length < count) {
      const raw = randomBytes(5).toString('hex').toUpperCase();
      const formatted = `${raw.slice(0, 5)}-${raw.slice(5, 10)}`;
      if (!codes.includes(formatted)) codes.push(formatted);
    }
    return codes;
  }

  private hashRecoveryCode(code: string): string {
    return createHash('sha256').update(code.toUpperCase().replace(/-/g, '')).digest('hex');
  }

  private async readRecoveryCodeRecords(userId: number): Promise<Array<{ hash: string; usedAt: string | null; createdAt?: string }>> {
    const row = await this.db.findOne(SystemConstants.TABLE.META, { key: this.getRecoveryCodesKey(userId) });
    const raw = String(row?.value || '').trim();
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.map((e) => ({ hash: String(e?.hash || '').trim(), usedAt: e?.usedAt ? String(e.usedAt) : null, createdAt: e?.createdAt ? String(e.createdAt) : undefined })).filter((e) => !!e.hash);
    } catch { return []; }
  }

  private async writeRecoveryCodeRecords(userId: number, records: Array<{ hash: string; usedAt: string | null; createdAt?: string }>) {
    const key = this.getRecoveryCodesKey(userId);
    await this.upsertMetaValue(key, JSON.stringify(records));
  }

  private async upsertMetaValue(key: string, value: string) {
    const existing = await this.db.findOne(SystemConstants.TABLE.META, { key });
    if (existing) {
      await this.db.update(SystemConstants.TABLE.META, { key }, { value });
      return;
    }

    await this.db.insert(SystemConstants.TABLE.META, { key, value });
  }

  private resolveErrorStatus(error: any): number {
    const message = String(error?.message || '').trim().toLowerCase();
    if (message.includes('user not found')) {
      return 404;
    }
    if (
      message.includes('invalid') ||
      message.includes('not initiated') ||
      message.includes('must be enabled')
    ) {
      return 400;
    }
    return 500;
  }

  private async sendSecurityNotification(options: { userId: number; subject: string; title: string; details?: string[] }) {
    try {
      const enabled = await this.db.findOne(SystemConstants.TABLE.META, { key: SystemConstants.META_KEY.AUTH_SECURITY_NOTIFICATIONS });
      if (String(enabled?.value || 'true').trim().toLowerCase() !== 'true') return;
      const user = await this.db.findOne(users, { id: options.userId });
      const recipient = AuthUtils.normalizeEmail(user?.email);
      if (!recipient) return;
      const appName = process.env.APP_NAME || 'Fromcode';
      const from = process.env.EMAIL_FROM || process.env.SMTP_FROM || 'no-reply@fromcode.com';
      const details = Array.isArray(options.details) ? options.details.filter(Boolean) : [];
      await this.emailGetter().send({
        to: recipient, from, subject: `${appName}: ${options.subject}`,
        text: `${options.title}\n\n${details.join('\n')}`,
        html: `<p>${options.title}</p>${details.length > 0 ? `<ul>${details.map((l) => `<li>${l}</li>`).join('')}</ul>` : ''}`,
      });
    } catch {}
  }
}
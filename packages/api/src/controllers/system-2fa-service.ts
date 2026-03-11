/** SystemTwoFactorService — 2FA management endpoints. Extracted from SystemController (ARC-007). */

import { Request, Response } from 'express';
import { SystemConstants } from '@fromcode119/sdk';
import { createHash, randomBytes } from 'crypto';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import { users } from '@fromcode119/database';
import { AuthUtils } from '../utils/auth';
import { UserManagementService } from '../services/user-management-service';

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
      const enabledRow = await this.db.findOne(SystemConstants.TABLE.META, { key: `user:${userId}:2fa_enabled` });
      const recoveryCodes = await this.readRecoveryCodeRecords(userId);
      res.json({ enabled: enabledRow?.value === 'true', recoveryCodesRemaining: recoveryCodes.filter((e) => !e.usedAt).length });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  }

  async setup2FA(req: Request, res: Response) {
    try {
      const userId = parseInt(req.params.id, 10);
      if (Number.isNaN(userId)) return res.status(400).json({ error: 'Invalid user id' });
      const user = await this.users.getUser(userId);
      if (!user) return res.status(404).json({ error: 'User not found' });
      const secret = speakeasy.generateSecret({ name: `Fromcode (${user.email})`, length: 32 });
      const qrCode = await QRCode.toDataURL(secret.otpauth_url!);
      const existingSecret = await this.db.findOne(SystemConstants.TABLE.META, { key: `user:${userId}:totp_secret_pending` });
      if (existingSecret) { await this.db.update(SystemConstants.TABLE.META, { key: `user:${userId}:totp_secret_pending` }, { value: secret.base32 }); }
      else { await this.db.insert(SystemConstants.TABLE.META, { key: `user:${userId}:totp_secret_pending`, value: secret.base32 }); }
      res.json({ secret: secret.base32, qrCode });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  }

  async verify2FA(req: Request, res: Response) {
    try {
      const userId = parseInt(req.params.id, 10);
      if (Number.isNaN(userId)) return res.status(400).json({ error: 'Invalid user id' });
      const { token } = req.body;
      if (!token) return res.status(400).json({ error: 'Token is required' });
      const secretRow = await this.db.findOne(SystemConstants.TABLE.META, { key: `user:${userId}:totp_secret_pending` });
      if (!secretRow) return res.status(400).json({ error: '2FA setup not initiated. Please start setup first.' });
      const verified = speakeasy.totp.verify({ secret: secretRow.value, encoding: 'base32', token, window: 1 });
      if (!verified) return res.status(400).json({ error: 'Invalid verification code' });

      const existingTOTPSecret = await this.db.findOne(SystemConstants.TABLE.META, { key: `user:${userId}:totp_secret` });
      if (existingTOTPSecret) { await this.db.update(SystemConstants.TABLE.META, { key: `user:${userId}:totp_secret` }, { value: secretRow.value }); }
      else { await this.db.insert(SystemConstants.TABLE.META, { key: `user:${userId}:totp_secret`, value: secretRow.value }); }

      const existing2FAEnabled = await this.db.findOne(SystemConstants.TABLE.META, { key: `user:${userId}:2fa_enabled` });
      if (existing2FAEnabled) { await this.db.update(SystemConstants.TABLE.META, { key: `user:${userId}:2fa_enabled` }, { value: 'true' }); }
      else { await this.db.insert(SystemConstants.TABLE.META, { key: `user:${userId}:2fa_enabled`, value: 'true' }); }

      const recoveryCodes = this.generateRecoveryCodes();
      await this.writeRecoveryCodeRecords(userId, recoveryCodes.map((code) => ({ hash: this.hashRecoveryCode(code), usedAt: null as string | null, createdAt: new Date().toISOString() })));
      await this.db.delete(SystemConstants.TABLE.META, { key: `user:${userId}:totp_secret_pending` });
      await this.sendSecurityNotification({ userId, subject: 'Two-factor authentication enabled', title: 'Two-factor authentication has been enabled on your account.', details: [`Time: ${new Date().toISOString()}`] });
      res.json({ success: true, message: '2FA enabled successfully', recoveryCodes });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  }

  async regenerateRecoveryCodes(req: Request, res: Response) {
    try {
      const userId = parseInt(req.params.id, 10);
      if (Number.isNaN(userId)) return res.status(400).json({ error: 'Invalid user id' });
      const enabledRow = await this.db.findOne(SystemConstants.TABLE.META, { key: `user:${userId}:2fa_enabled` });
      if (enabledRow?.value !== 'true') return res.status(400).json({ error: '2FA must be enabled before recovery codes can be generated.' });
      const recoveryCodes = this.generateRecoveryCodes();
      await this.writeRecoveryCodeRecords(userId, recoveryCodes.map((code) => ({ hash: this.hashRecoveryCode(code), usedAt: null as string | null, createdAt: new Date().toISOString() })));
      res.json({ success: true, recoveryCodes });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  }

  async disable2FA(req: Request, res: Response) {
    try {
      const userId = parseInt(req.params.id, 10);
      if (Number.isNaN(userId)) return res.status(400).json({ error: 'Invalid user id' });
      await this.db.delete(SystemConstants.TABLE.META, { key: `user:${userId}:2fa_enabled` });
      await this.db.delete(SystemConstants.TABLE.META, { key: `user:${userId}:totp_secret` });
      await this.db.delete(SystemConstants.TABLE.META, { key: `user:${userId}:totp_secret_pending` });
      await this.db.delete(SystemConstants.TABLE.META, { key: this.getRecoveryCodesKey(userId) });
      await this.sendSecurityNotification({ userId, subject: 'Two-factor authentication disabled', title: 'Two-factor authentication has been disabled on your account.', details: [`Time: ${new Date().toISOString()}`] });
      res.json({ success: true, message: '2FA disabled successfully' });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  }

  // --- Private helpers ---

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
    const existing = await this.db.findOne(SystemConstants.TABLE.META, { key });
    const value = JSON.stringify(records);
    if (existing) { await this.db.update(SystemConstants.TABLE.META, { key }, { value }); }
    else { await this.db.insert(SystemConstants.TABLE.META, { key, value }); }
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
    } catch { /* best-effort */ }
  }
}

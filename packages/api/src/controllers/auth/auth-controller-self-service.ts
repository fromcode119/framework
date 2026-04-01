import { Response } from 'express';
import { SystemConstants } from '@fromcode119/core';
import { AuthControllerSecurity } from './auth-controller-security';
import { SystemTwoFactorService } from '../system-2fa-service';
import { UserManagementService } from '../../services/user-management-service';

export class AuthControllerSelfService extends AuthControllerSecurity {
  async getMySecurityState(req: any, res: Response) {
    const userId = this.parseUserId(req.user?.id);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const user = await this.db.findOne(SystemConstants.TABLE.USERS, { id: userId });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const status = await this.getUserAccountStatus(userId);
    const forcePasswordReset = await this.getForcePasswordReset(userId);
    const emailVerified = await this.isEmailVerified(userId);
    const policy = await this.getPasswordPolicySettings();
    const changedAt = await this.getMetaValue(this.getPasswordChangedAtKey(userId));
    const profile = await this.readProfile(userId);
    const twoFactor = await this.getTwoFactorService().getStatusForUser(userId);

    return res.json({
      user: {
        id: userId,
        email: this.normalizeEmail(user.email),
        firstName: this.readUserFirstName(user),
        lastName: this.readUserLastName(user),
        phone: profile.phone,
        roles: this.readRoles(user),
      },
      profile,
      account: {
        status,
        forcePasswordReset,
        emailVerified,
        passwordChangedAt: changedAt || null,
      },
      twoFactor,
      passwordPolicy: {
        minLength: policy.minLength,
        requireUppercase: policy.requireUppercase,
        requireLowercase: policy.requireLowercase,
        requireNumber: policy.requireNumber,
        requireSymbol: policy.requireSymbol,
      },
    });
  }

  async updateMyProfile(req: any, res: Response) {
    const userId = this.parseUserId(req.user?.id);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const user = await this.db.findOne(SystemConstants.TABLE.USERS, { id: userId });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const profile = this.sanitizeProfilePayload(req.body || {});
    await this.db.update(SystemConstants.TABLE.USERS, { id: userId }, {
      firstName: profile.firstName || null,
      lastName: profile.lastName || null,
      updatedAt: new Date(),
    });
    await this.upsertMeta(this.getProfileKey(userId), JSON.stringify({
      phone: profile.phone,
      addressLine1: profile.addressLine1,
      addressLine2: profile.addressLine2,
      city: profile.city,
      postalCode: profile.postalCode,
      country: profile.country,
    }));

    return res.json({
      success: true,
      user: {
        id: userId,
        email: this.normalizeEmail(user.email),
        firstName: profile.firstName,
        lastName: profile.lastName,
        phone: profile.phone,
        roles: this.readRoles(user),
      },
      profile,
    });
  }

  async getMyTwoFactorStatus(req: any, res: Response) {
    const userId = this.parseUserId(req.user?.id);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    return res.json(await this.getTwoFactorService().getStatusForUser(userId));
  }

  async setupMyTwoFactor(req: any, res: Response) {
    const userId = this.parseUserId(req.user?.id);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    try {
      return res.json(await this.getTwoFactorService().setupForUser(userId));
    } catch (error: any) {
      return res.status(this.resolveTwoFactorStatus(error)).json({ error: error?.message || 'Failed to start 2FA setup' });
    }
  }

  async verifyMyTwoFactor(req: any, res: Response) {
    const userId = this.parseUserId(req.user?.id);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const token = String(req.body?.token || '').trim();
    if (!token) return res.status(400).json({ error: 'Token is required' });
    try {
      return res.json(await this.getTwoFactorService().verifyForUser(userId, token));
    } catch (error: any) {
      return res.status(this.resolveTwoFactorStatus(error)).json({ error: error?.message || 'Failed to verify 2FA' });
    }
  }

  async regenerateMyRecoveryCodes(req: any, res: Response) {
    const userId = this.parseUserId(req.user?.id);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    try {
      return res.json(await this.getTwoFactorService().regenerateRecoveryCodesForUser(userId));
    } catch (error: any) {
      return res.status(this.resolveTwoFactorStatus(error)).json({ error: error?.message || 'Failed to regenerate recovery codes' });
    }
  }

  async disableMyTwoFactor(req: any, res: Response) {
    const userId = this.parseUserId(req.user?.id);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    try {
      return res.json(await this.getTwoFactorService().disableForUser(userId));
    } catch (error: any) {
      return res.status(this.resolveTwoFactorStatus(error)).json({ error: error?.message || 'Failed to disable 2FA' });
    }
  }

  protected getProfileKey(userId: number): string {
    return `user:${userId}:profile`;
  }

  protected async readProfile(userId: number): Promise<Record<string, string>> {
    const row = await this.readMetaRow(this.getProfileKey(userId));
    const baseProfile = {
      firstName: '',
      lastName: '',
      phone: '',
      addressLine1: '',
      addressLine2: '',
      city: '',
      postalCode: '',
      country: 'BG',
    };

    if (!row?.value) {
      return baseProfile;
    }

    try {
      const parsed = JSON.parse(String(row.value));
      return {
        ...baseProfile,
        phone: String(parsed?.phone || '').trim(),
        addressLine1: String(parsed?.addressLine1 || '').trim(),
        addressLine2: String(parsed?.addressLine2 || '').trim(),
        city: String(parsed?.city || '').trim(),
        postalCode: String(parsed?.postalCode || '').trim(),
        country: String(parsed?.country || 'BG').trim().toUpperCase() || 'BG',
      };
    } catch {
      return baseProfile;
    }
  }

  protected sanitizeProfilePayload(payload: Record<string, any>): Record<string, string> {
    return {
      firstName: String(payload.firstName || '').trim(),
      lastName: String(payload.lastName || '').trim(),
      phone: String(payload.phone || '').trim(),
      addressLine1: String(payload.addressLine1 || '').trim(),
      addressLine2: String(payload.addressLine2 || '').trim(),
      city: String(payload.city || '').trim(),
      postalCode: String(payload.postalCode || '').trim(),
      country: String(payload.country || 'BG').trim().toUpperCase() || 'BG',
    };
  }

  protected getTwoFactorService(): SystemTwoFactorService {
    return new SystemTwoFactorService(
      this.db,
      () => this.manager.email,
      new UserManagementService(this.db, this.auth, this.manager),
    );
  }

  protected resolveTwoFactorStatus(error: any): number {
    const message = String(error?.message || '').trim().toLowerCase();
    if (message.includes('user not found')) {
      return 404;
    }
    if (message.includes('invalid') || message.includes('not initiated') || message.includes('must be enabled')) {
      return 400;
    }
    return 500;
  }
}

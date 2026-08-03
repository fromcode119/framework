import { NotificationType } from '@/components/enums/notification-type.enum';
import { UserSecurityPageController } from '@/app/users/[id]/security/user-security-page-controller';
import type { IUserSecurityPageHost } from '@/app/users/[id]/security/interfaces/user-security-page-host.interface';
/**
 * Orchestration for the user security page: binds {@link UserSecurityPageController} I/O to the
 * page-client's state and notifications. Hook-free — it only touches React through the host.
 */
export class UserSecurityPageActions {
  constructor(private readonly host: IUserSecurityPageHost) {}

  private async fetchAuthActivity(email: string): Promise<void> {
    if (!email.trim()) {
      this.host.patch({ authActivity: [] });
      return;
    }
    this.host.patch({ authActivityLoading: true });
    try {
      const authActivity = await UserSecurityPageController.fetchAuthActivity(email);
      if (!this.host.mounted) return;
      this.host.patch({ authActivity });
    } catch (error) {
      console.error('[UserSecurityPage] Failed to fetch auth activity:', error);
      if (this.host.mounted) this.host.patch({ authActivity: [] });
    } finally {
      if (this.host.mounted) this.host.patch({ authActivityLoading: false });
    }
  }

  async fetchUserSecurity(): Promise<void> {
    const { addNotification } = this.host.notify;
    const id = this.host.id;
    try {
      const user = await UserSecurityPageController.fetchUser(id);
      if (this.host.mounted) this.host.patch({ user });
      const twoFactorStatus = await UserSecurityPageController.fetchTwoFactorStatus(id);
      await this.fetchAuthActivity(String(user?.email || ''));
      if (!this.host.mounted) return;
      this.host.patch({
        twoFactorEnabled: Boolean(twoFactorStatus.enabled),
        recoveryCodesRemaining: Number(twoFactorStatus.recoveryCodesRemaining || 0),
      });
    } catch (error) {
      console.error('[UserSecurityPage] Failed to fetch user security:', error);
      addNotification({ title: 'Error', message: 'Failed to load security settings', type: NotificationType.ERROR });
    } finally {
      if (this.host.mounted) this.host.patch({ loading: false });
    }
  }

  async fetchMySessions(): Promise<void> {
    if (!this.host.isSelf) return;
    this.host.patch({ sessionsLoading: true });
    try {
      const mySessions = await UserSecurityPageController.fetchMySessions();
      if (!this.host.mounted) return;
      this.host.patch({ mySessions });
    } catch (error) {
      console.error('[UserSecurityPage] Failed to fetch sessions:', error);
      if (this.host.mounted) this.host.patch({ mySessions: [] });
    } finally {
      if (this.host.mounted) this.host.patch({ sessionsLoading: false });
    }
  }

  async fetchMyApiTokens(): Promise<void> {
    if (!this.host.isSelf) return;
    this.host.patch({ tokensLoading: true });
    try {
      const myApiTokens = await UserSecurityPageController.fetchMyApiTokens();
      if (!this.host.mounted) return;
      this.host.patch({ myApiTokens });
    } catch (error) {
      console.error('[UserSecurityPage] Failed to fetch API tokens:', error);
      if (this.host.mounted) this.host.patch({ myApiTokens: [] });
    } finally {
      if (this.host.mounted) this.host.patch({ tokensLoading: false });
    }
  }

  async copyRecoveryCodes(): Promise<void> {
    const { addNotification } = this.host.notify;
    const { generatedRecoveryCodes } = this.host;
    if (!generatedRecoveryCodes.length) return;
    if (await UserSecurityPageController.copyRecoveryCodes(generatedRecoveryCodes)) {
      addNotification({ title: 'Copied', message: 'Recovery codes copied to clipboard.', type: NotificationType.SUCCESS });
      return;
    }
    addNotification({ title: 'Copy Failed', message: 'Please copy the recovery codes manually.', type: NotificationType.ERROR });
  }

  async createApiToken(): Promise<void> {
    const { addNotification } = this.host.notify;
    const { tokenName, tokenDays } = this.host;
    try {
      if (!tokenName.trim()) {
        addNotification({ title: 'Name Required', message: 'Enter a token name first.', type: NotificationType.ERROR });
        return;
      }
      const createdToken = await UserSecurityPageController.createApiToken(tokenName, tokenDays);
      if (this.host.mounted) this.host.patch({ createdToken, tokenName: '' });
      addNotification({ title: 'Token Created', message: 'Copy the token now. It is shown once.', type: NotificationType.SUCCESS });
      await this.fetchMyApiTokens();
    } catch (error: any) {
      addNotification({ title: 'Error', message: error?.message || 'Failed to create API token', type: NotificationType.ERROR });
    }
  }

  async disableTwoFactor(): Promise<void> {
    const { addNotification } = this.host.notify;
    if (!confirm('Are you sure you want to disable 2FA for this user? This will reduce account security.')) return;
    try {
      await UserSecurityPageController.disableTwoFactor(this.host.id);
      if (this.host.mounted) {
        this.host.patch({
          twoFactorEnabled: false,
          qrCode: null,
          secret: null,
          generatedRecoveryCodes: [],
          recoveryCodesRemaining: 0,
        });
      }
      addNotification({ title: '2FA Disabled', message: 'Two-factor authentication has been removed', type: NotificationType.INFO });
    } catch (error: any) {
      addNotification({ title: 'Error', message: error.message || 'Failed to disable 2FA', type: NotificationType.ERROR });
    }
  }

  async enableTwoFactor(): Promise<void> {
    const { addNotification } = this.host.notify;
    this.host.patch({ isEnabling: true });
    try {
      const response = await UserSecurityPageController.setupTwoFactor(this.host.id);
      if (this.host.mounted) this.host.patch({ qrCode: response.qrCode || null, secret: response.secret || null });
      addNotification({ title: 'Setup Started', message: 'Scan the QR code with your authenticator app', type: NotificationType.INFO });
    } catch (error: any) {
      addNotification({ title: 'Setup Failed', message: error.message || 'Failed to generate 2FA setup', type: NotificationType.ERROR });
    } finally {
      if (this.host.mounted) this.host.patch({ isEnabling: false });
    }
  }

  async regenerateRecoveryCodes(): Promise<void> {
    const { addNotification } = this.host.notify;
    if (!confirm('Regenerate recovery codes? Existing unused codes will stop working immediately.')) return;
    this.host.patch({ isRegeneratingCodes: true });
    try {
      const codes = await UserSecurityPageController.regenerateRecoveryCodes(this.host.id);
      if (this.host.mounted) this.host.patch({ generatedRecoveryCodes: codes, recoveryCodesRemaining: codes.length });
      addNotification({ title: 'Recovery Codes Regenerated', message: 'Save the new codes now. Old codes are invalid.', type: NotificationType.SUCCESS });
    } catch (error: any) {
      addNotification({ title: 'Regeneration Failed', message: error.message || 'Unable to regenerate recovery codes.', type: NotificationType.ERROR });
    } finally {
      if (this.host.mounted) this.host.patch({ isRegeneratingCodes: false });
    }
  }

  async verifyTwoFactor(): Promise<void> {
    const { addNotification } = this.host.notify;
    const { verificationCode } = this.host;
    if (!UserSecurityPageController.isCompleteVerificationCode(verificationCode)) {
      addNotification({ title: 'Invalid Code', message: 'Please enter a 6-digit verification code', type: NotificationType.ERROR });
      return;
    }
    this.host.patch({ isVerifying: true });
    try {
      const recoveryCodes = await UserSecurityPageController.verifyTwoFactor(this.host.id, verificationCode);
      if (this.host.mounted) {
        this.host.patch({
          twoFactorEnabled: true,
          qrCode: null,
          secret: null,
          verificationCode: '',
          generatedRecoveryCodes: recoveryCodes,
          recoveryCodesRemaining: recoveryCodes.length,
        });
      }
      addNotification({ title: '2FA Enabled', message: 'Two-factor authentication is now active', type: NotificationType.SUCCESS });
    } catch (error: any) {
      addNotification({ title: 'Verification Failed', message: error.message || 'Invalid verification code', type: NotificationType.ERROR });
    } finally {
      if (this.host.mounted) this.host.patch({ isVerifying: false });
    }
  }

  async revokeApiToken(tokenId: string): Promise<void> {
    const { addNotification } = this.host.notify;
    try {
      await UserSecurityPageController.revokeApiToken(tokenId);
      addNotification({ title: 'Token Revoked', message: 'API token revoked successfully.', type: NotificationType.SUCCESS });
      await this.fetchMyApiTokens();
    } catch (error: any) {
      addNotification({ title: 'Error', message: error?.message || 'Failed to revoke API token', type: NotificationType.ERROR });
    }
  }

  async revokeOtherSessions(): Promise<void> {
    const { addNotification } = this.host.notify;
    try {
      await UserSecurityPageController.revokeOtherSessions();
      addNotification({ title: 'Done', message: 'Other sessions revoked.', type: NotificationType.SUCCESS });
      await this.fetchMySessions();
    } catch (error: any) {
      addNotification({ title: 'Error', message: error?.message || 'Failed to revoke other sessions', type: NotificationType.ERROR });
    }
  }

  async revokeSession(sessionId: string): Promise<void> {
    const { addNotification } = this.host.notify;
    try {
      const revokedCurrent = await UserSecurityPageController.revokeSession(sessionId);
      addNotification({ title: 'Session Revoked', message: 'Device session revoked successfully.', type: NotificationType.SUCCESS });
      if (revokedCurrent) {
        this.host.redirectToLogin();
        return;
      }
      await this.fetchMySessions();
    } catch (error: any) {
      addNotification({ title: 'Error', message: error?.message || 'Failed to revoke session', type: NotificationType.ERROR });
    }
  }
}

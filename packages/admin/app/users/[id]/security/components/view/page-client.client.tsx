import type { ReactNode } from 'react';
import { state } from '@fromcode119/reactor';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { AdminComponent } from '@/components/view/admin-component.client';
import type { INotificationContextType } from '@/components/interfaces/notification-context-type.interface';
import { UserSecurityView } from '@/app/users/[id]/security/components/view/user-security-view.client';
import { UserSecurityPageActions } from '@/app/users/[id]/security/user-security-page-actions';
import { UserSecurityPageController } from '@/app/users/[id]/security/user-security-page-controller';
import { UserSecurityPageService } from '@/app/users/[id]/security/user-security-page-service';
import type { IAuthActivityEntry } from '@/app/users/[id]/security/interfaces/auth-activity-entry.interface';
import type { IAuthUserRecord } from '@/app/users/[id]/security/interfaces/auth-user-record.interface';
import type { ISecurityUserRecord } from '@/app/users/[id]/security/interfaces/security-user-record.interface';
import type { IUserApiTokenRecord } from '@/app/users/[id]/security/interfaces/user-api-token-record.interface';
import type { IUserSecurityPageClientState } from '@/app/users/[id]/security/interfaces/user-security-page-client-state.interface';
import type { IUserSecurityPageHost } from '@/app/users/[id]/security/interfaces/user-security-page-host.interface';
import type { IUserSecurityPageModel } from '@/app/users/[id]/security/interfaces/user-security-page-model.interface';
import type { IUserSessionRecord } from '@/app/users/[id]/security/interfaces/user-session-record.interface';

export class UserSecurityPageClient extends AdminComponent implements IUserSecurityPageHost {
  mounted = false;

  private prevId: string | undefined = undefined;
  private prevIsSelf: boolean | undefined = undefined;
  private readonly actions = new UserSecurityPageActions(this);

  @state loading = true;
  @state user: ISecurityUserRecord | null = null;
  @state twoFactorEnabled = false;
  @state qrCode: string | null = null;
  @state secret: string | null = null;
  @state verificationCode = '';
  @state isEnabling = false;
  @state isVerifying = false;
  @state isRegeneratingCodes = false;
  @state recoveryCodesRemaining = 0;
  @state generatedRecoveryCodes: string[] = [];
  @state authActivity: IAuthActivityEntry[] = [];
  @state authActivityLoading = false;
  @state mySessions: IUserSessionRecord[] = [];
  @state sessionsLoading = false;
  @state myApiTokens: IUserApiTokenRecord[] = [];
  @state tokensLoading = false;
  @state tokenName = '';
  @state tokenDays = '30';
  @state createdToken = '';

  /** Route param `[id]` — read from the runtime context instead of `useParams()`. */
  get id(): string {
    return String(this.runtimeParams?.id || '');
  }

  get isSelf(): boolean {
    const authUser = this.auth?.user as IAuthUserRecord | undefined;
    return UserSecurityPageService.isSameUser(authUser?.id, this.id);
  }

  get notify(): INotificationContextType {
    return this.runtime.notify;
  }

  redirectToLogin(): void {
    this.router.push(AdminConstants.ROUTES.AUTH.LOGIN);
  }

  patch(patch: Partial<IUserSecurityPageClientState>): void {
    this.setState(patch as never);
  }

  patchWith(updater: (state: IUserSecurityPageClientState) => Partial<IUserSecurityPageClientState>): void {
    this.setState((value) => updater(value as unknown as IUserSecurityPageClientState) as never);
  }

  componentDidMount(): void {
    this.mounted = true;
    this.syncUserSecurity();
    this.syncSelfScopedData();
  }

  componentDidUpdate(): void {
    this.syncUserSecurity();
    this.syncSelfScopedData();
  }

  componentWillUnmount(): void {
    this.mounted = false;
  }

  /** Mirrors the original `useEffect(..., [id])`. */
  private syncUserSecurity(): void {
    if (this.prevId === this.id) return;
    this.prevId = this.id;
    void this.actions.fetchUserSecurity();
  }

  /** Mirrors the original `useEffect(..., [isSelf])`. */
  private syncSelfScopedData(): void {
    if (this.prevIsSelf === this.isSelf) return;
    this.prevIsSelf = this.isSelf;
    if (!this.isSelf) return;
    void this.actions.fetchMySessions();
    void this.actions.fetchMyApiTokens();
  }

  private buildModel(): IUserSecurityPageModel {
    const {
      authActivity,
      authActivityLoading,
      createdToken,
      generatedRecoveryCodes,
      isEnabling,
      isRegeneratingCodes,
      isVerifying,
      loading,
      myApiTokens,
      mySessions,
      qrCode,
      recoveryCodesRemaining,
      secret,
      sessionsLoading,
      tokenDays,
      tokenName,
      tokensLoading,
      twoFactorEnabled,
      user,
      verificationCode,
    } = this;

    return {
      authActivity,
      authActivityLoading,
      copyRecoveryCodes: () => this.actions.copyRecoveryCodes(),
      createApiToken: () => this.actions.createApiToken(),
      createdToken,
      generatedRecoveryCodes,
      handleDisable2FA: () => this.actions.disableTwoFactor(),
      handleEnable2FA: () => this.actions.enableTwoFactor(),
      handleRegenerateRecoveryCodes: () => this.actions.regenerateRecoveryCodes(),
      handleVerify2FA: () => this.actions.verifyTwoFactor(),
      id: this.id,
      isEnabling,
      isRegeneratingCodes,
      isSelf: this.isSelf,
      isVerifying,
      loading,
      myApiTokens,
      mySessions,
      qrCode,
      recoveryCodesRemaining,
      revokeApiToken: (tokenId) => this.actions.revokeApiToken(tokenId),
      revokeOtherSessions: () => this.actions.revokeOtherSessions(),
      revokeSession: (sessionId) => this.actions.revokeSession(sessionId),
      routerBackHref: AdminConstants.ROUTES.USERS.DETAIL(this.id),
      secret,
      sessionsLoading,
      setTokenDays: (value) => { this.tokenDays = value; },
      setTokenName: (value) => { this.tokenName = value; },
      setVerificationCode: (value) => {
        this.verificationCode = UserSecurityPageController.normalizeVerificationCode(value);
      },
      themeMode: this.theme,
      tokenDays,
      tokenName,
      tokensLoading,
      twoFactorEnabled,
      user,
      verificationCode,
    };
  }

  render(): ReactNode {
    return <UserSecurityView model={this.buildModel()} />;
  }
}

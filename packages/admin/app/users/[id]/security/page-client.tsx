"use client";

import React from 'react';
import { AdminConstants } from '@/lib/constants';
import { AdminComponent } from '@/components/admin-component';
import type { NotificationContextType } from '@/components/notification-context.interfaces';
import UserSecurityView from './components/user-security-view';
import { UserSecurityPageActions } from './user-security-page-actions';
import { UserSecurityPageController } from './user-security-page-controller';
import { UserSecurityPageService } from './user-security-page-service';
import type {
  AuthUserRecord,
  UserSecurityPageClientState,
  UserSecurityPageHost,
  UserSecurityPageModel,
} from './user-security-page.interfaces';

export default class UserSecurityPageClient
  extends AdminComponent<Record<string, never>, UserSecurityPageClientState>
  implements UserSecurityPageHost {
  mounted = false;

  private prevId: string | undefined = undefined;
  private prevIsSelf: boolean | undefined = undefined;
  private readonly actions = new UserSecurityPageActions(this);

  state: UserSecurityPageClientState = {
    loading: true,
    user: null,
    twoFactorEnabled: false,
    qrCode: null,
    secret: null,
    verificationCode: '',
    isEnabling: false,
    isVerifying: false,
    isRegeneratingCodes: false,
    recoveryCodesRemaining: 0,
    generatedRecoveryCodes: [],
    authActivity: [],
    authActivityLoading: false,
    mySessions: [],
    sessionsLoading: false,
    myApiTokens: [],
    tokensLoading: false,
    tokenName: '',
    tokenDays: '30',
    createdToken: '',
  };

  /** Route param `[id]` — read from the runtime context instead of `useParams()`. */
  get id(): string {
    return String(this.params?.id || '');
  }

  get isSelf(): boolean {
    const authUser = this.auth?.user as AuthUserRecord | undefined;
    return UserSecurityPageService.isSameUser(authUser?.id, this.id);
  }

  get notify(): NotificationContextType {
    return this.runtime.notify;
  }

  redirectToLogin(): void {
    this.router.push(AdminConstants.ROUTES.AUTH.LOGIN);
  }

  patch(patch: Partial<UserSecurityPageClientState>): void {
    this.setState(patch as Pick<UserSecurityPageClientState, keyof UserSecurityPageClientState>);
  }

  patchWith(updater: (state: UserSecurityPageClientState) => Partial<UserSecurityPageClientState>): void {
    this.setState((value) => updater(value) as Pick<UserSecurityPageClientState, keyof UserSecurityPageClientState>);
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

  private buildModel(): UserSecurityPageModel {
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
    } = this.state;

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
      setTokenDays: (value) => this.setState({ tokenDays: value }),
      setTokenName: (value) => this.setState({ tokenName: value }),
      setVerificationCode: (value) => this.setState({
        verificationCode: UserSecurityPageController.normalizeVerificationCode(value),
      }),
      themeMode: this.theme,
      tokenDays,
      tokenName,
      tokensLoading,
      twoFactorEnabled,
      user,
      verificationCode,
    };
  }

  render(): React.ReactNode {
    return <UserSecurityView model={this.buildModel()} />;
  }
}

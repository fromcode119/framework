import type { NotificationContextType } from '@/components/notification-context.interfaces';
import type { AdminPageHost } from '@/components/admin-page-host.interfaces';

/** What {@link UserSecurityPageActions} needs from the page-client to drive it, hook-free. */
export interface UserSecurityPageHost extends AdminPageHost<UserSecurityPageClientState> {
  readonly notify: NotificationContextType;
  /** Route param `[id]` — the user whose security page this is. */
  readonly id: string;
  /** True when the admin is viewing their own security page. */
  readonly isSelf: boolean;
  /** Navigate away (used when the caller revokes its own session). */
  redirectToLogin(): void;
}

export interface AuthActivityEntry {
  context?: {
    email?: string;
  };
  createdAt?: string;
  email?: string;
  id?: number | string;
  level?: string;
  message?: string;
  timestamp?: string;
}

export interface AuthUserRecord {
  id?: number | string;
}

export interface SecurityUserRecord {
  email?: string;
  id?: number | string;
  roles?: string[];
}

export interface UserApiTokenRecord {
  createdAt?: string;
  id: number | string;
  name?: string;
  prefix?: string;
  revokedAt?: string;
}

export interface UserSessionRecord {
  expiresAt?: string;
  id: number | string;
  ipAddress?: string;
  isCurrent?: boolean;
  userAgent?: string;
}

export interface UserTwoFactorSetupResponse {
  qrCode?: string;
  secret?: string;
}

export interface UserTwoFactorStatusResponse {
  enabled?: boolean;
  recoveryCodesRemaining?: number;
}

export interface UserTwoFactorVerifyResponse {
  recoveryCodes?: string[];
}

export interface UserSecurityPageClientState {
  loading: boolean;
  user: SecurityUserRecord | null;
  twoFactorEnabled: boolean;
  qrCode: string | null;
  secret: string | null;
  verificationCode: string;
  isEnabling: boolean;
  isVerifying: boolean;
  isRegeneratingCodes: boolean;
  recoveryCodesRemaining: number;
  generatedRecoveryCodes: string[];
  authActivity: AuthActivityEntry[];
  authActivityLoading: boolean;
  mySessions: UserSessionRecord[];
  sessionsLoading: boolean;
  myApiTokens: UserApiTokenRecord[];
  tokensLoading: boolean;
  tokenName: string;
  tokenDays: string;
  createdToken: string;
}

export interface UserSecurityPageModel {
  authActivity: AuthActivityEntry[];
  authActivityLoading: boolean;
  copyRecoveryCodes: () => Promise<void>;
  createApiToken: () => Promise<void>;
  createdToken: string;
  generatedRecoveryCodes: string[];
  handleDisable2FA: () => Promise<void>;
  handleEnable2FA: () => Promise<void>;
  handleRegenerateRecoveryCodes: () => Promise<void>;
  handleVerify2FA: () => Promise<void>;
  id: string;
  isEnabling: boolean;
  isRegeneratingCodes: boolean;
  isSelf: boolean;
  isVerifying: boolean;
  loading: boolean;
  myApiTokens: UserApiTokenRecord[];
  mySessions: UserSessionRecord[];
  qrCode: string | null;
  recoveryCodesRemaining: number;
  revokeApiToken: (tokenId: string) => Promise<void>;
  revokeOtherSessions: () => Promise<void>;
  revokeSession: (sessionId: string) => Promise<void>;
  routerBackHref: string;
  secret: string | null;
  sessionsLoading: boolean;
  setTokenDays: (value: string) => void;
  setTokenName: (value: string) => void;
  setVerificationCode: (value: string) => void;
  themeMode: string;
  tokenDays: string;
  tokenName: string;
  tokensLoading: boolean;
  twoFactorEnabled: boolean;
  user: SecurityUserRecord | null;
  verificationCode: string;
}

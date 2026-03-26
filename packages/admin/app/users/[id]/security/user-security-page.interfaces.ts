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

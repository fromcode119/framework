import { ThemeMode } from '@fromcode119/core/client';

import type { IAuthActivityEntry } from '@/app/users/[id]/security/interfaces/auth-activity-entry.interface';
import type { ISecurityUserRecord } from '@/app/users/[id]/security/interfaces/security-user-record.interface';
import type { IUserApiTokenRecord } from '@/app/users/[id]/security/interfaces/user-api-token-record.interface';
import type { IUserSessionRecord } from '@/app/users/[id]/security/interfaces/user-session-record.interface';

export interface IUserSecurityPageModel {
  authActivity: IAuthActivityEntry[];
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
  myApiTokens: IUserApiTokenRecord[];
  mySessions: IUserSessionRecord[];
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
  themeMode: ThemeMode;
  tokenDays: string;
  tokenName: string;
  tokensLoading: boolean;
  twoFactorEnabled: boolean;
  user: ISecurityUserRecord | null;
  verificationCode: string;
}

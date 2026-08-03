import type { IAuthActivityEntry } from '@/app/users/[id]/security/interfaces/auth-activity-entry.interface';
import type { ISecurityUserRecord } from '@/app/users/[id]/security/interfaces/security-user-record.interface';
import type { IUserApiTokenRecord } from '@/app/users/[id]/security/interfaces/user-api-token-record.interface';
import type { IUserSessionRecord } from '@/app/users/[id]/security/interfaces/user-session-record.interface';

export interface IUserSecurityPageClientState {
  loading: boolean;
  user: ISecurityUserRecord | null;
  twoFactorEnabled: boolean;
  qrCode: string | null;
  secret: string | null;
  verificationCode: string;
  isEnabling: boolean;
  isVerifying: boolean;
  isRegeneratingCodes: boolean;
  recoveryCodesRemaining: number;
  generatedRecoveryCodes: string[];
  authActivity: IAuthActivityEntry[];
  authActivityLoading: boolean;
  mySessions: IUserSessionRecord[];
  sessionsLoading: boolean;
  myApiTokens: IUserApiTokenRecord[];
  tokensLoading: boolean;
  tokenName: string;
  tokenDays: string;
  createdToken: string;
}

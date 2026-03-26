/** Interface definitions for AuthController */

export interface PasswordPolicySettings {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumber: boolean;
  requireSymbol: boolean;
  historyCount: number;
  breachCheck: boolean;
}

export interface LoginThrottleSettings {
  threshold: number;
  windowMinutes: number;
  lockoutMinutes: number;
  captchaEnabled: boolean;
  captchaThreshold: number;
}

export interface LoginThrottleState {
  count: number;
  firstFailureAt?: string;
  lastFailureAt?: string;
  lockedUntil?: string;
}

export interface ApiTokenRecord {
  id: string;
  name: string;
  hash: string;
  prefix: string;
  scopes: string[];
  createdAt: string;
  createdByIp?: string;
  expiresAt?: string | null;
  revokedAt?: string | null;
  lastUsedAt?: string | null;
}

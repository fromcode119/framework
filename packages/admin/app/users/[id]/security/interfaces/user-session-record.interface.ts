export interface IUserSessionRecord {
  expiresAt?: string;
  id: number | string;
  ipAddress?: string;
  isCurrent?: boolean;
  userAgent?: string;
}

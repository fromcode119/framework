export interface IApiTokenRecord {
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

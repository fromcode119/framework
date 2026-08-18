export interface IMcpTokenSummary {
  tokenId: string;
  label: string;
  scopes: string[];
  createdAt: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
}

export interface IMcpTokenSummary {
  tokenId: string;
  label: string;
  scopes: string[];
  createdAt: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
  /** The site this token acts on; `null` = every site (platform token, names its site per request). */
  site: string | null;
  /** Issued before tokens recorded a site; bound to the site whose admin issued it. */
  legacy: boolean;
}

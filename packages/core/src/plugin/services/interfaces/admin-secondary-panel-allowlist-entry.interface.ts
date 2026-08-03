export interface IAdminSecondaryPanelAllowlistEntry {
  entryId?: string;
  sourceCanonicalKey: string;
  scope: string;
  targetCanonicalKey: string;
  allowed: boolean;
  reason?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
  expiresAt?: string;
}

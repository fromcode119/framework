export interface IAdminSecondaryPanelRejection {
  reasonCode: string;
  sourceCanonicalKey: string;
  itemId: string;
  scope: string;
  targetCanonicalKey: string;
  details?: string;
}

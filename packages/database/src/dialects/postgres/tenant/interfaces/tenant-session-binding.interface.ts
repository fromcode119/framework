/** What a connection is acting as, for the duration it is held. */
export interface ITenantSessionBinding {
  tenantId?: string | null;
  platformAdmin?: boolean;
}

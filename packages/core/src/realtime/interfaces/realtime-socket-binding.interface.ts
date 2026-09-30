/**
 * Who a live socket belongs to, decided by the api when it accepted the connection: the site whose
 * events it may hear. `null` only on a deployment without sites.
 */
export interface IRealtimeSocketBinding {
  tenantId: string | null;
}

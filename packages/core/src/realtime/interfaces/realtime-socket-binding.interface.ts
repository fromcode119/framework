/**
 * Who a live socket belongs to, decided by the api when it accepted the connection: the site whose
 * events it may hear. `null` only on a deployment without sites.
 *
 * `room` is set for a socket admitted with a room token (`RealtimeRoomTokens`) instead of an
 * administrator's session. Such a socket hears that one room of that one site and nothing else — never
 * the site's collection writes, which are an administrator's view.
 */
export interface IRealtimeSocketBinding {
  tenantId: string | null;
  room?: string | null;
}

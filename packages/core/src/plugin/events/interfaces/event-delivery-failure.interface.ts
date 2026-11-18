/** One failing (event, plugin, site), as the console lists it. */
export interface IEventDeliveryFailure {
  id: number | string;
  event: string;
  pluginSlug: string;
  tenantId: string;
  attempts: number;
  error: string;
  payload: unknown;
  updatedAt: string;
}

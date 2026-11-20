/** A failed event delivery as the console lists it (API JSON). */
export interface IEventDeliveryFailure {
  id: number | string;
  event: string;
  pluginSlug: string;
  tenantId: string;
  attempts: number;
  error: string;
  updatedAt: string;
}

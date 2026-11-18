import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import type { IEventDeliveryFailure } from '@/app/plugins/events/interfaces/event-delivery-failure.interface';

/**
 * Data access for the event-deliveries page. Hook-free by contract: the page-client owns React state
 * and notifications; this owns "how to fetch/do it".
 */
export class EventDeliveriesPageController {
  /** The currently-failing deliveries, newest first. Throws on transport failure. */
  static async fetchFailures(): Promise<IEventDeliveryFailure[]> {
    const result = await AdminApi.get(AdminConstants.ENDPOINTS.PLUGINS.EVENT_DELIVERIES) as { deliveries?: IEventDeliveryFailure[] };
    return Array.isArray(result?.deliveries) ? result.deliveries : [];
  }

  /** Re-run one recorded failure against the plugin's current listener. Throws on a failed retry. */
  static async retry(id: string | number): Promise<void> {
    await AdminApi.post(AdminConstants.ENDPOINTS.PLUGINS.EVENT_DELIVERY_RETRY(id), {});
  }
}

import { Request, Response } from 'express';
import { BaseController, PluginManager, CoercionUtils, EventDeliveryLedger } from '@fromcode119/core';

/**
 * The console's view of events a plugin listener failed to handle: the open failures, and a retry that
 * re-runs one against the plugin's current listener. Platform-admin only (see the router) — it touches
 * every site's deliveries, which is the operator's view, not one customer's.
 */
export class EventDeliveryController extends BaseController {
  constructor(private readonly manager: PluginManager) {
    super();
  }

  /** The currently-failing deliveries, newest first. */
  list = async (_req: Request, res: Response): Promise<void> => {
    const deliveries = await EventDeliveryLedger.listOpenFailures(this.manager as never);
    res.json({ deliveries });
  };

  /** Re-run one recorded failure against the plugin's current listener. */
  retry = async (req: Request, res: Response): Promise<void> => {
    const id = CoercionUtils.toRelationId(req.params.id);
    if (!id) {
      res.status(400).json({ error: 'Invalid delivery id' });
      return;
    }
    const result = await EventDeliveryLedger.retry(this.manager as never, id);
    if (result.notFound) {
      res.status(404).json({ error: 'Delivery not found' });
      return;
    }
    if (!result.ok) {
      res.status(409).json({ error: result.error ?? 'Retry failed' });
      return;
    }
    res.json({ ok: true });
  };
}

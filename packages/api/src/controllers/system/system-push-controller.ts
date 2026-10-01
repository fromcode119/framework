import type { Request, Response } from 'express';
import { MetaContextProxy, PushSenderKeys, PushSubscriptionStore, PushSurface } from '@fromcode119/core';

/**
 * A person's own devices that accept this site's push messages.
 *
 * The person ALWAYS comes from the session, never from the request, as on the email preferences
 * screen: a device is added to, listed for and removed from the signed-in person only. A push
 * endpoint is a URL the browser hands over, so only an https URL is accepted, and it is reached later
 * only on the public internet (`PushDelivery`).
 */
export class SystemPushController {
  private static readonly MAX_ENDPOINT_LENGTH = 2048;
  private static readonly KEY_PATTERN = /^[A-Za-z0-9_-]+$/;

  constructor(private readonly manager: any) {} // eslint-disable-line @typescript-eslint/no-explicit-any

  private get store(): PushSubscriptionStore {
    return new PushSubscriptionStore(this.manager.db);
  }

  /** The public key a browser subscribes with. */
  async key(_req: Request, res: Response): Promise<void> {
    await this.run(res, async () => ({ publicKey: await new PushSenderKeys(MetaContextProxy.createMetaProxy(this.manager)).publicKey() }));
  }

  async list(req: Request, res: Response): Promise<void> {
    await this.run(res, async () => {
      const userId = SystemPushController.userId(req);
      const rows = await this.store.forPerson(userId);
      return { devices: rows.map((row) => ({ id: row.id, surface: row.surface, label: String(row.label ?? ''), createdAt: row.created_at ?? null, lastSentAt: row.last_sent_at ?? null })) };
    });
  }

  async subscribe(req: Request, res: Response): Promise<void> {
    await this.run(res, async () => {
      const userId = SystemPushController.userId(req);
      const body = (req.body ?? {}) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
      const surface = PushSurface.fromValue(String(body.surface ?? '')) as PushSurface | undefined;
      const subscription = SystemPushController.subscription(body.subscription);
      if (!surface || !subscription) throw Object.assign(new Error('Not a usable push subscription'), { status: 400 });
      await this.store.save(userId, surface, subscription, String(body.label ?? '').trim());
      return { success: true };
    }, 201);
  }

  async unsubscribe(req: Request, res: Response): Promise<void> {
    await this.run(res, async () => {
      const endpoint = String((req.body as any)?.endpoint ?? '').trim(); // eslint-disable-line @typescript-eslint/no-explicit-any
      if (!endpoint) throw Object.assign(new Error('An endpoint is required'), { status: 400 });
      await this.store.remove(SystemPushController.userId(req), endpoint);
      return { success: true };
    });
  }

  /** The browser's `PushSubscription.toJSON()`, accepted only as an https endpoint with two well-formed keys. */
  private static subscription(value: unknown): { endpoint: string; p256dh: string; auth: string } | null {
    const raw = (value ?? {}) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    const endpoint = String(raw.endpoint ?? '').trim();
    const p256dh = String(raw.keys?.p256dh ?? '').trim();
    const auth = String(raw.keys?.auth ?? '').trim();
    if (!endpoint || endpoint.length > SystemPushController.MAX_ENDPOINT_LENGTH) return null;
    try {
      if (new URL(endpoint).protocol !== 'https:') return null;
    } catch {
      return null;
    }
    const valid = (key: string, bytes: number) => SystemPushController.KEY_PATTERN.test(key) && Buffer.from(key, 'base64url').length === bytes;
    return valid(p256dh, 65) && valid(auth, 16) ? { endpoint, p256dh, auth } : null;
  }

  private static userId(req: Request): number {
    const id = Number((req as any).user?.id); // eslint-disable-line @typescript-eslint/no-explicit-any
    if (!Number.isFinite(id) || id <= 0) throw Object.assign(new Error('Not authenticated'), { status: 401 });
    return id;
  }

  private async run(res: Response, work: () => Promise<unknown>, status = 200): Promise<void> {
    try {
      res.status(status).json(await work());
    } catch (err: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
      res.status(err?.status ?? 500).json({ error: err?.message ?? 'Internal server error' });
    }
  }
}

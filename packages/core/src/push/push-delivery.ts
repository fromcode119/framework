import { Logger } from '@core/logging';
import { ApplicationUrlUtils } from '@core/utils/application-url-utils';
import { SiteBaseUrl } from '@core/tenant/site-base-url';
import { PublicNetworkFetch } from '@core/security/public-network-fetch';
import { WebPushEncryption } from '@core/push/web-push-encryption';
import { PushSenderKeys } from '@core/push/push-sender-keys';
import { PushSubscriptionStore } from '@core/push/push-subscription-store';
import { ExpoPushTransport } from '@core/push/expo-push-transport';
import { PushSurface } from '@core/push/enums/push-surface.enum';
import type { IPluginContextMeta } from '@core/plugin/interfaces/plugin-context-meta.interface';

/**
 * Sends a push message to a person's devices on the site this code runs for.
 *
 * Each browser gets its own encrypted copy (only that browser can read it), signed with the site's push
 * key; a phone running the site's app gets it through Expo's push service ({@link ExpoPushTransport}). A device the push service no longer knows (404/410) is forgotten at once; one that keeps
 * failing is forgotten after a few tries. The push service's address came from a browser, so it is
 * reached only over https and only on the public internet — never redirected, never inside the
 * platform's network.
 *
 * A failed push never fails the caller: it is an extra way of reaching someone, not the record of
 * what happened.
 */
export class PushDelivery {
  /** How long a push service keeps trying a device that is off, in seconds. */
  private static readonly TIME_TO_LIVE = 24 * 3600;
  private static readonly TIMEOUT_MS = 10_000;
  private static readonly logger = new Logger({ namespace: 'push' });

  private readonly store: PushSubscriptionStore;
  private readonly keys: PushSenderKeys;
  private readonly app: ExpoPushTransport;

  constructor(db: any, meta: IPluginContextMeta, private readonly fetcher: typeof PublicNetworkFetch.fetch = PublicNetworkFetch.fetch) {
    this.store = new PushSubscriptionStore(db);
    this.keys = new PushSenderKeys(meta);
    this.app = new ExpoPushTransport(fetcher);
  }

  /**
   * Push `message` to every device of `userId` — on `surface` only when one is given, on each of them
   * when several are. Returns how many took it.
   */
  async toPerson(userId: number, message: { title: string; body?: string; link?: string }, surface?: PushSurface | readonly PushSurface[]): Promise<number> {
    const devices = await this.devicesOf(userId, surface);
    if (!devices.length) return 0;
    const content = { title: String(message.title ?? '').slice(0, 200), body: String(message.body ?? '').slice(0, 1000), link: String(message.link ?? '') };
    const payload = JSON.stringify(content);
    const subject = await SiteBaseUrl.forCurrentSite(ApplicationUrlUtils.FRONTEND_APP);
    let delivered = 0;
    for (const device of devices) {
      const sent = device.surface === PushSurface.APP.value ? await this.sendToApp(device, content) : await this.send(device, payload, subject);
      if (sent) delivered += 1;
    }
    return delivered;
  }

  private async devicesOf(userId: number, surface?: PushSurface | readonly PushSurface[]): Promise<Array<Record<string, any>>> {
    if (!Array.isArray(surface)) return this.store.forPerson(userId, surface as PushSurface | undefined);
    const lists = await Promise.all(surface.map((one) => this.store.forPerson(userId, one)));
    return lists.flat();
  }

  private async sendToApp(device: Record<string, any>, content: { title: string; body: string; link: string }): Promise<boolean> {
    try {
      const outcome = await this.app.send(String(device.endpoint), content, PushDelivery.TIMEOUT_MS);
      if (outcome.delivered) {
        await this.store.delivered(Number(device.id));
        return true;
      }
      await this.store.failed(device, outcome.gone);
      PushDelivery.logger.warn(outcome.gone ? 'An app device is no longer registered' : 'An app push was refused');
    } catch (error) {
      await this.store.failed(device, false).catch(() => undefined);
      PushDelivery.logger.warn(`An app push could not be sent: ${String((error as Error)?.message ?? error)}`);
    }
    return false;
  }

  private async send(device: Record<string, any>, payload: string, subject: string): Promise<boolean> {
    try {
      const endpoint = new URL(String(device.endpoint));
      if (endpoint.protocol !== 'https:') throw new Error('A push endpoint must be https');
      const response = await this.fetcher(endpoint.toString(), {
        method: 'POST',
        redirect: 'error',
        signal: AbortSignal.timeout(PushDelivery.TIMEOUT_MS),
        headers: {
          Authorization: await this.keys.authorization(endpoint.origin, subject),
          'Content-Encoding': 'aes128gcm',
          'Content-Type': 'application/octet-stream',
          TTL: String(PushDelivery.TIME_TO_LIVE),
          Urgency: 'normal',
        },
        body: WebPushEncryption.encrypt(payload, { p256dh: String(device.p256dh), auth: String(device.auth) }),
      });
      await response.body?.cancel().catch(() => undefined);
      if (response.status >= 200 && response.status < 300) {
        await this.store.delivered(Number(device.id));
        return true;
      }
      await this.store.failed(device, response.status === 404 || response.status === 410);
      PushDelivery.logger.warn(`A push device answered ${response.status}`);
    } catch (error) {
      await this.store.failed(device, false).catch(() => undefined);
      PushDelivery.logger.warn(`A push message could not be sent: ${String((error as Error)?.message ?? error)}`);
    }
    return false;
  }
}

import { PublicNetworkFetch } from '@core/security/public-network-fetch';

/**
 * Delivers a message to a phone running the site's own mobile app, through Expo's push service, which
 * hands it on to Apple or Google. The device's address is the Expo push token the app registered —
 * not a URL — so the push service is always the one fixed address below.
 *
 * The service answers each message with a ticket: `ok`, or an error. `DeviceNotRegistered` means the
 * app was removed or its notifications switched off, and the token will never work again.
 */
export class ExpoPushTransport {
  static readonly SEND_URL = 'https://exp.host/--/api/v2/push/send';
  static readonly TOKEN_PATTERN = /^Expo(nent)?PushToken\[[A-Za-z0-9_-]{8,}\]$/;
  private static readonly GONE = 'DeviceNotRegistered';

  constructor(private readonly fetcher: typeof PublicNetworkFetch.fetch = PublicNetworkFetch.fetch) {}

  static isToken(value: unknown): boolean {
    return ExpoPushTransport.TOKEN_PATTERN.test(String(value ?? ''));
  }

  /** Send one message to one app token. `gone`: the token is dead and should be forgotten. */
  async send(token: string, message: { title: string; body: string; link: string }, timeoutMs: number): Promise<{ delivered: boolean; gone: boolean }> {
    const response = await this.fetcher(ExpoPushTransport.SEND_URL, {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(timeoutMs),
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify([{ to: token, title: message.title, body: message.body, data: { link: message.link }, sound: 'default' }]),
    });
    if (response.status < 200 || response.status >= 300) {
      await response.body?.cancel().catch(() => undefined);
      return { delivered: false, gone: false };
    }
    const answer = await response.json().catch(() => null);
    const ticket = Array.isArray(answer?.data) ? answer.data[0] : answer?.data;
    if (ticket?.status === 'ok') return { delivered: true, gone: false };
    return { delivered: false, gone: ticket?.details?.error === ExpoPushTransport.GONE };
  }
}

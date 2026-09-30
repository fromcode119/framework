import dns, { type LookupAddress } from 'node:dns';
import { isIP } from 'node:net';
import { Agent, fetch as undiciFetch } from 'undici';
import { NetworkAddressUtils } from '@core/security/network-address-utils';

/**
 * `fetch` that can only reach the public internet — the one outbound path a plugin has (`context.fetch`).
 *
 * The request is made by the api, from inside the platform's network, so an unchecked URL could reach
 * what no visitor can: redis, the database, the api's own loopback, the cloud provider's metadata
 * address. Several plugins send requests to URLs a site's admin typed in (webhooks), and a check
 * before the request is not enough — the name is resolved again when the socket opens, and a DNS
 * answer that changes in between walks straight past it. So the address is checked AT CONNECT, on the
 * very addresses the socket then uses, and every redirect hop is checked again the same way.
 */
export class PublicNetworkFetch {
  static readonly MAX_REDIRECTS = 20;
  static readonly REFUSED_CODE = 'EREFUSEDADDRESS';
  private static readonly REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
  private static agent: Agent | null = null;

  static async fetch(rawUrl: string, init: Record<string, any> = {}): Promise<Response> {
    const mode = String(init.redirect ?? 'follow');
    let url = PublicNetworkFetch.assertTarget(rawUrl);
    let request: Record<string, any> = { ...init, redirect: 'manual', dispatcher: PublicNetworkFetch.dispatcher() };
    for (let hop = 0; ; hop += 1) {
      const response = await PublicNetworkFetch.send(url, request);
      if (mode === 'manual' || !PublicNetworkFetch.REDIRECT_STATUSES.has(response.status)) return response;
      const location = response.headers.get('location');
      if (!location) return response;
      await response.body?.cancel().catch(() => undefined);
      if (mode === 'error') throw new TypeError(`fetch refused a redirect from ${url}`);
      if (hop >= PublicNetworkFetch.MAX_REDIRECTS) throw new TypeError(`fetch stopped after ${PublicNetworkFetch.MAX_REDIRECTS} redirects`);
      const next = PublicNetworkFetch.assertTarget(new URL(location, url).toString());
      request = PublicNetworkFetch.followRequest(request, response.status, new URL(url).origin !== new URL(next).origin);
      url = next;
    }
  }

  /** The URL itself: http(s) only, and an address written as an IP must already be a public one. */
  static assertTarget(rawUrl: string): string {
    let url: URL;
    try {
      url = new URL(String(rawUrl ?? ''));
    } catch {
      throw new TypeError(`fetch refused an invalid URL`);
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw PublicNetworkFetch.refusal(`fetch refused ${url.protocol} — only http and https are allowed`);
    }
    const host = url.hostname.replace(/^\[|\]$/g, '');
    if (isIP(host) && !NetworkAddressUtils.isPublic(host)) {
      throw PublicNetworkFetch.refusal(`fetch refused ${url.host}: not a public internet address`);
    }
    return url.toString();
  }

  /**
   * The resolver the socket connects with: every address the name resolves to must be public, and the
   * socket then uses exactly those — nothing is resolved twice.
   */
  static lookup(hostname: string, options: Record<string, any>, callback: (...args: any[]) => void): void {
    dns.lookup(hostname, { family: options?.family ?? 0, hints: options?.hints, all: true, verbatim: true }, (error, addresses) => {
      if (error) return callback(error);
      const list = addresses as LookupAddress[];
      const refused = list.find((entry) => !NetworkAddressUtils.isPublic(entry.address));
      if (!list.length || refused) {
        return callback(PublicNetworkFetch.refusal(`fetch refused ${hostname}: it resolves to ${refused?.address ?? 'nothing'}, not a public internet address`));
      }
      if (options?.all) return callback(null, list);
      callback(null, list[0].address, list[0].family);
    });
  }

  /** A refused connection reaches `fetch` as "fetch failed" with the reason as its cause; the reason is what the caller needs. */
  private static async send(url: string, request: Record<string, any>): Promise<Response> {
    try {
      return (await undiciFetch(url, request as any)) as unknown as Response;
    } catch (error: any) {
      if (error?.cause?.code === PublicNetworkFetch.REFUSED_CODE) throw error.cause;
      throw error;
    }
  }

  static isRefusal(error: unknown): boolean {
    return (error as { code?: unknown } | null)?.code === PublicNetworkFetch.REFUSED_CODE;
  }

  /** What the next hop sends, as `fetch` itself does: 303 (and a POST's 301/302) becomes a GET; credentials stay on their origin. */
  private static followRequest(request: Record<string, any>, status: number, crossOrigin: boolean): Record<string, any> {
    const method = String(request.method ?? 'GET').toUpperCase();
    const headers = new Headers(request.headers ?? {});
    const next: Record<string, any> = { ...request };
    if ((status === 303 && method !== 'HEAD') || ((status === 301 || status === 302) && method === 'POST')) {
      next.method = 'GET';
      delete next.body;
      for (const name of ['content-type', 'content-length', 'content-encoding', 'content-language', 'content-location']) headers.delete(name);
    }
    if (crossOrigin) {
      headers.delete('authorization');
      headers.delete('cookie');
      headers.delete('proxy-authorization');
    }
    next.headers = headers;
    return next;
  }

  private static dispatcher(): Agent {
    PublicNetworkFetch.agent ??= new Agent({ connect: { lookup: PublicNetworkFetch.lookup as any } });
    return PublicNetworkFetch.agent;
  }

  private static refusal(message: string): Error {
    return Object.assign(new Error(message), { code: PublicNetworkFetch.REFUSED_CODE });
  }
}

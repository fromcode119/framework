import { FrontendAuthRequestHeaders } from '@/lib/frontend-auth-request-headers';

/**
 * Redeems a one-time link token (email verification, email change) once per page load.
 *
 * The page that redeems it can mount twice — the runtime re-renders it after hydration — and a second
 * post of the same token is answered "invalid or already used", which then replaced the first
 * request's success on screen. Every mount now shares the one request and shows its outcome.
 */
export class FrontendTokenRedemption {
  private static readonly inFlight = new Map<string, Promise<{ ok: boolean; payload: any }>>();

  static redeem(url: string, token: string): Promise<{ ok: boolean; payload: any }> {
    const key = `${url}\n${token}`;
    let request = FrontendTokenRedemption.inFlight.get(key);
    if (!request) {
      request = fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: FrontendAuthRequestHeaders.json(),
        body: JSON.stringify({ token }),
      }).then(async (response) => ({ ok: response.ok, payload: await response.json().catch(() => ({})) }));
      // Only a success is final; a refused or failed attempt may be tried again from the page.
      request.then((result) => { if (!result.ok) FrontendTokenRedemption.inFlight.delete(key); }, () => FrontendTokenRedemption.inFlight.delete(key));
      FrontendTokenRedemption.inFlight.set(key, request);
    }
    return request;
  }
}

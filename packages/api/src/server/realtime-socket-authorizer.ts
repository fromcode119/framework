import type * as http from 'http';
import { CookieConstants, TenantMode } from '@fromcode119/core';
import type { IRealtimeSocketBinding } from '@fromcode119/core';

/**
 * Who may open the live socket, and which site it then hears.
 *
 * What the socket carries is every collection write as it happens, whole rows included, so it is an
 * ADMINISTRATOR's view of one site: a valid session whose roles include `admin`, bound to the site
 * that session is for. Nobody else is admitted — not an anonymous visitor, and not a customer, who
 * would otherwise watch every other customer's orders arrive.
 *
 * The session is read from the cookies only, the newest valid one winning, for the reason
 * `AdminTenantResolver` gives: a browser can present two sessions of the same name.
 *
 * The one other way in is a room token (`?room=`), minted by a plugin for a browser it checked —
 * a visitor in a support chat, say. It admits that browser to that room of that site and nothing
 * else (`RealtimeRoomTokens`). A request that presents a room token is judged by the token alone:
 * a bad one is refused, never retried as an administrator's session.
 */
export class RealtimeSocketAuthorizer {
  private static readonly COOKIES: readonly string[] = [CookieConstants.AUTH_TOKEN, CookieConstants.CLIENT_AUTH_TOKEN];

  static readonly ROOM_PARAM = 'room';

  constructor(
    private readonly auth: { verifyToken(token: string): Promise<unknown> },
    private readonly rooms: { verify(token: string): Promise<{ tenantId: string | null; room: string } | null> },
  ) {}

  async authorize(request: http.IncomingMessage, url: URL): Promise<IRealtimeSocketBinding | null> {
    if (url.searchParams.has(RealtimeSocketAuthorizer.ROOM_PARAM)) {
      const admitted = await this.rooms.verify(url.searchParams.get(RealtimeSocketAuthorizer.ROOM_PARAM) || '').catch(() => null);
      return admitted ? { tenantId: admitted.tenantId, room: admitted.room } : null;
    }
    let newest: Record<string, unknown> | null = null;
    for (const token of RealtimeSocketAuthorizer.tokensFrom(request)) {
      try {
        const claim = (await this.auth.verifyToken(token)) as Record<string, unknown> | null;
        if (claim && (!newest || Number(claim.iat ?? 0) >= Number(newest.iat ?? 0))) newest = claim;
      } catch {
        // An expired or forged cookie beside a good one must not deny the good one.
      }
    }
    if (!newest) return null;

    const roles = Array.isArray(newest.roles) ? newest.roles.map(String) : [];
    if (!roles.includes('admin')) return null;

    const tenantId = String(newest.tenantId ?? '').trim() || null;
    if (TenantMode.isEnabled() && !tenantId) return null;
    return { tenantId };
  }

  private static tokensFrom(request: http.IncomingMessage): string[] {
    const found: string[] = [];
    for (const part of String(request.headers?.cookie || '').split(';')) {
      const [name, ...rest] = part.trim().split('=');
      if (!RealtimeSocketAuthorizer.COOKIES.includes(name)) continue;
      const value = decodeURIComponent(rest.join('=').trim());
      if (value && !found.includes(value)) found.push(value);
    }
    return found;
  }
}

import { randomBytes } from 'crypto';
import { SecretService } from '@core/security/secret-service';
import type { IPluginPlatformTicket } from '@core/plugin/platform/interfaces/plugin-platform-ticket.interface';

/**
 * The ticket a plugin's TENANT part hands its PLATFORM part (`context.platform.connectUrl` → `claim`).
 *
 * It names the site or workspace that asked, sealed with the installation's key (AES-GCM, so it can be
 * neither read nor altered): the platform part carries it through a provider's sign-in and back without
 * ever learning whose it is, and nobody can mint one for a site they are not signed in to.
 *
 * It expires: a ticket is a capability, and one copied out of a browser's history must not connect an
 * account to that site days later. It is used once (`PluginPlatformHandoffs`, keyed by its nonce), and
 * it names the account that asked: the claim it leads to is finished only by that account, on that
 * site's console (`context.platform.complete`) — never by whoever the link was sent to.
 */
export class PluginPlatformTicket {
  static readonly LIFETIME_MS = 30 * 60 * 1000;

  static mint(input: Pick<IPluginPlatformTicket, 'slug' | 'tenantId' | 'userId' | 'returnTo' | 'completeUrl'>, now = Date.now()): string {
    const ticket: IPluginPlatformTicket = {
      slug: input.slug,
      tenantId: input.tenantId,
      userId: input.userId,
      returnTo: input.returnTo,
      completeUrl: input.completeUrl,
      exp: now + PluginPlatformTicket.LIFETIME_MS,
      nonce: randomBytes(16).toString('hex'),
    };
    return Buffer.from(SecretService.encrypt(JSON.stringify(ticket)), 'utf8').toString('base64url');
  }

  /** The ticket, when it was sealed here, for `slug`, and has not expired; otherwise null. */
  static open(slug: string, value: unknown, now = Date.now()): IPluginPlatformTicket | null {
    const sealed = Buffer.from(String(value ?? ''), 'base64url').toString('utf8');
    // `decrypt` passes an unsealed value through unchanged — a plain JSON ticket must not be accepted.
    if (!SecretService.isEncryptedValue(sealed)) return null;
    try {
      const ticket = JSON.parse(SecretService.decrypt(sealed)) as IPluginPlatformTicket;
      if (ticket?.slug !== slug || !(Number(ticket.exp) > now)) return null;
      // A ticket sealed before tickets named their account and their console carries neither: refused.
      if (!ticket.userId || !ticket.completeUrl || !ticket.nonce) return null;
      return {
        ...ticket,
        tenantId: ticket.tenantId ? String(ticket.tenantId) : null,
        userId: String(ticket.userId),
        returnTo: String(ticket.returnTo || ''),
        completeUrl: String(ticket.completeUrl),
        nonce: String(ticket.nonce),
      };
    } catch {
      return null;
    }
  }
}

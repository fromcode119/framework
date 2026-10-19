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
 * account to that site days later.
 */
export class PluginPlatformTicket {
  static readonly LIFETIME_MS = 30 * 60 * 1000;

  static mint(input: { slug: string; tenantId: string | null; returnTo: string }, now = Date.now()): string {
    const ticket: IPluginPlatformTicket = {
      slug: input.slug,
      tenantId: input.tenantId,
      returnTo: input.returnTo,
      exp: now + PluginPlatformTicket.LIFETIME_MS,
      nonce: randomBytes(8).toString('hex'),
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
      return { ...ticket, tenantId: ticket.tenantId ? String(ticket.tenantId) : null, returnTo: String(ticket.returnTo || '') };
    } catch {
      return null;
    }
  }
}

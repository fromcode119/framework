import { RequestContextUtils } from '@core/context/request-context';
import { MetaContextProxy } from '@core/plugin/context/meta';
import { SigningSecretService } from '@core/security/signing-secret-service';
import { TenantMode } from '@core/tenant/tenant-mode';
import type { IPluginManagerInterface } from '@core/plugin/context/interfaces/plugin-manager-interface.interface';

/**
 * A short-lived address for one stored file, whatever space it lives in (`context.media.signedUrl`).
 *
 * An extension that sells files checks the person itself and then hands over the file. A public file's
 * own address works for anyone, forever, once it has been seen; reading a private one through the
 * extension sends megabytes across its process boundary as base64. This token lets the API serve the
 * private file itself, in parts, for a few minutes, to whoever holds the link.
 *
 * Carried in the path as `v1.<payload>.<signature>`: the payload names the site, the file and when it
 * expires, and the signature is the SITE's own key for this purpose. So a link minted on one site
 * opens nothing on another, and a link cannot be made for a file no extension handed out.
 */
export class MediaSignedTokens {
  static readonly PURPOSE = 'system.media-signed';
  static readonly DEFAULT_TTL_SECONDS = 600;
  static readonly MAX_TTL_SECONDS = 86_400;
  private static readonly MIN_TTL_SECONDS = 30;
  private static readonly VERSION = 'v1';

  constructor(private readonly manager: IPluginManagerInterface) {}

  /** A token for the file `mediaId` of the site this code runs for. Throws without a site — "no site" is never every site. */
  async mint(mediaId: string, ttlSeconds: number = MediaSignedTokens.DEFAULT_TTL_SECONDS, now = Date.now()): Promise<string> {
    const id = String(mediaId ?? '').trim();
    if (!/^\d+$/.test(id)) throw new Error('A signed file address needs the id of a stored file');
    const ttl = MediaSignedTokens.ttl(ttlSeconds);
    const claim = { s: MediaSignedTokens.currentSite(), m: id, e: Math.floor(now / 1000) + ttl };
    const signed = `${MediaSignedTokens.VERSION}.${Buffer.from(JSON.stringify(claim)).toString('base64url')}`;
    return `${signed}.${SigningSecretService.sign(await this.key(), signed)}`;
  }

  /** The file id a token opens on the site `tenantId`, or null for anything forged, expired, malformed or minted elsewhere. */
  async verify(token: string, tenantId: string | null, now = Date.now()): Promise<string | null> {
    const [version, payload, signature, extra] = String(token ?? '').split('.');
    if (version !== MediaSignedTokens.VERSION || !payload || !signature || extra !== undefined) return null;
    let claim: { s?: unknown; m?: unknown; e?: unknown };
    try {
      claim = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    } catch {
      return null;
    }
    if (!(Number(claim?.e) > now / 1000)) return null;
    const id = String(claim?.m ?? '').trim();
    if (!/^\d+$/.test(id)) return null;
    const site = String(claim?.s ?? '').trim() || null;
    const bound = String(tenantId ?? '').trim() || null;
    if (TenantMode.isEnabled() && (!site || site !== bound)) return null;
    const valid = await this.onSite(site, async () => SigningSecretService.verify(await this.key(), `${version}.${payload}`, signature));
    return valid ? id : null;
  }

  /** Whole seconds between the floor and the ceiling; anything unreadable is the default. */
  static ttl(seconds: unknown): number {
    const asked = Math.floor(Number(seconds));
    if (!Number.isFinite(asked) || asked <= 0) return MediaSignedTokens.DEFAULT_TTL_SECONDS;
    return Math.min(MediaSignedTokens.MAX_TTL_SECONDS, Math.max(MediaSignedTokens.MIN_TTL_SECONDS, asked));
  }

  private key(): Promise<string> {
    return SigningSecretService.signingKey(MetaContextProxy.createMetaProxy(this.manager), MediaSignedTokens.PURPOSE);
  }

  /** The signing key is the site's: read it inside that site's scope, as a request for it would. */
  private async onSite<T>(tenantId: string | null, work: () => Promise<T>): Promise<T> {
    if (!TenantMode.isEnabled() || !tenantId) return work();
    return RequestContextUtils.storage.run({ tenantId }, () => this.manager.db.withTenant(tenantId, work));
  }

  private static currentSite(): string | null {
    if (!TenantMode.isEnabled()) return null;
    const tenantId = String(RequestContextUtils.getTenantId() ?? '').trim();
    if (!tenantId) throw new Error('A signed file address belongs to a site; this code is not running for one');
    return tenantId;
  }
}

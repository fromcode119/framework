import { RequestContextUtils } from '@core/context/request-context';
import { MetaContextProxy } from '@core/plugin/context/meta';
import { SigningSecretService } from '@core/security/signing-secret-service';
import { TenantMode } from '@core/tenant/tenant-mode';
import { StorefrontNoticeDisplay } from '@core/storefront-notice/storefront-notice-display';
import { StorefrontNoticeTone } from '@core/storefront-notice/storefront-notice-tone';
import type { IStorefrontNotice } from '@core/storefront-notice/interfaces/storefront-notice.interface';
import type { IPluginManagerInterface } from '@core/plugin/context/interfaces/plugin-manager-interface.interface';

/**
 * A one-time message for the visitor a server redirect sends to the storefront — "your subscription is
 * confirmed" after the link in an email was followed.
 *
 * Carried in the URL as `v1.<payload>.<signature>`: the payload holds the site, where it may be shown,
 * the words and when it expires; the signature is the SITE's own key for this purpose. So a notice
 * cannot be typed into the address bar (`?status=confirmed` once showed a confirmation to anyone), a
 * notice minted on one site cannot be shown on another, and one minted for a page cannot be shown as the
 * site-wide bar. The words are fixed by whoever minted it, in the site's language at that moment.
 */
export class StorefrontNoticeTokens {
  static readonly PURPOSE = 'system.storefront-notice';
  static readonly DEFAULT_TTL_SECONDS = 900;
  static readonly MAX_TTL_SECONDS = 86_400;
  private static readonly MIN_TTL_SECONDS = 60;
  private static readonly VERSION = 'v1';
  /** A notice is a sentence or two; the cap keeps the link a link. */
  static readonly MAX_TITLE = 200;
  static readonly MAX_BODY = 1_000;

  constructor(private readonly manager: IPluginManagerInterface) {}

  /** A token for `notice` on the site this code runs for. Throws without a site — "no site" is never every site. */
  async mint(notice: IStorefrontNotice, display: StorefrontNoticeDisplay, ttlSeconds: number = StorefrontNoticeTokens.DEFAULT_TTL_SECONDS): Promise<string> {
    const title = String(notice?.title ?? '').trim().slice(0, StorefrontNoticeTokens.MAX_TITLE);
    if (!title) throw new Error('A storefront notice needs a title');
    const body = String(notice?.body ?? '').trim().slice(0, StorefrontNoticeTokens.MAX_BODY);
    const tenantId = StorefrontNoticeTokens.currentSite();
    const ttl = Math.min(StorefrontNoticeTokens.MAX_TTL_SECONDS, Math.max(StorefrontNoticeTokens.MIN_TTL_SECONDS, Math.floor(Number(ttlSeconds) || StorefrontNoticeTokens.DEFAULT_TTL_SECONDS)));
    const claim = { s: tenantId, d: display.value, k: StorefrontNoticeTone.of(notice?.tone).value, t: title, b: body, e: Math.floor(Date.now() / 1000) + ttl };
    const signed = `${StorefrontNoticeTokens.VERSION}.${Buffer.from(JSON.stringify(claim)).toString('base64url')}`;
    return `${signed}.${SigningSecretService.sign(await this.key(), signed)}`;
  }

  /**
   * The notice a token carries, for the site `tenantId` and the display asking — or null for anything
   * forged, expired, malformed, minted for another site or for the other display.
   */
  async verify(token: string, tenantId: string | null, display: StorefrontNoticeDisplay): Promise<IStorefrontNotice | null> {
    const [version, payload, signature, extra] = String(token ?? '').split('.');
    if (version !== StorefrontNoticeTokens.VERSION || !payload || !signature || extra !== undefined) return null;
    let claim: { s?: unknown; d?: unknown; k?: unknown; t?: unknown; b?: unknown; e?: unknown };
    try {
      claim = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    } catch {
      return null;
    }
    if (!(Number(claim?.e) > Date.now() / 1000)) return null;
    if (StorefrontNoticeDisplay.parse(claim?.d) !== display) return null;
    const site = String(claim?.s ?? '').trim() || null;
    const bound = String(tenantId ?? '').trim() || null;
    if (TenantMode.isEnabled() && (!site || site !== bound)) return null;
    const title = String(claim?.t ?? '').trim();
    if (!title) return null;
    const valid = await this.onSite(site, async () => SigningSecretService.verify(await this.key(), `${version}.${payload}`, signature));
    if (!valid) return null;
    return { tone: StorefrontNoticeTone.of(claim?.k).value, title, body: String(claim?.b ?? '') };
  }

  private key(): Promise<string> {
    return SigningSecretService.signingKey(MetaContextProxy.createMetaProxy(this.manager), StorefrontNoticeTokens.PURPOSE);
  }

  /** The signing key is the site's: read it inside that site's scope, as a request for it would. */
  private async onSite<T>(tenantId: string | null, work: () => Promise<T>): Promise<T> {
    if (!TenantMode.isEnabled() || !tenantId) return work();
    return RequestContextUtils.storage.run({ tenantId }, () => this.manager.db.withTenant(tenantId, work));
  }

  private static currentSite(): string | null {
    if (!TenantMode.isEnabled()) return null;
    const tenantId = String(RequestContextUtils.getTenantId() ?? '').trim();
    if (!tenantId) throw new Error('A storefront notice belongs to a site; this code is not running for one');
    return tenantId;
  }
}

import { RequestContextUtils } from '@core/context/request-context';
import { MetaContextProxy } from '@core/plugin/context/meta';
import { SigningSecretService } from '@core/security/signing-secret-service';
import { TenantMode } from '@core/tenant/tenant-mode';
import type { IPluginManagerInterface } from '@core/plugin/context/interfaces/plugin-manager-interface.interface';

/**
 * The pass a browser shows to open a live socket on ONE room of ONE site.
 *
 * The admin's socket is admitted by an administrator's session, because it carries every write of the
 * site. A visitor chatting with support, or a customer whose order is being worked on, has no such
 * session — and must not hear anything but their own conversation. A plugin that decides who may
 * listen to a room mints a token for it (`context.realtime.roomToken`) and hands it to that browser;
 * the api admits a socket that presents it to that room only.
 *
 * The token is `v1.<payload>.<signature>`: the payload names the site, the room and when it expires,
 * in clear, and the signature is the SITE's own key for this purpose, so a token minted on one site
 * cannot open a room of another, and nobody can mint one without the platform's key. It admits a
 * connection; it is not checked again once the socket is open.
 */
export class RealtimeRoomTokens {
  static readonly PURPOSE = 'system.realtime-room';
  static readonly DEFAULT_TTL_SECONDS = 3_600;
  static readonly MAX_TTL_SECONDS = 86_400;
  private static readonly MIN_TTL_SECONDS = 60;
  private static readonly VERSION = 'v1';
  /** A room is a plugin-scoped name: `<plugin slug>:<name>`. */
  static readonly ROOM_PATTERN = /^[a-z0-9][a-z0-9_-]*:[A-Za-z0-9][A-Za-z0-9:._-]{0,119}$/;

  constructor(private readonly manager: IPluginManagerInterface) {}

  /** A token for `room` on the site this code runs for. Throws without a site — "no site" is never every site. */
  async mint(room: string, ttlSeconds: number = RealtimeRoomTokens.DEFAULT_TTL_SECONDS): Promise<string> {
    if (!RealtimeRoomTokens.ROOM_PATTERN.test(room)) throw new Error(`Not a realtime room name: "${room}"`);
    const tenantId = RealtimeRoomTokens.currentSite();
    const ttl = Math.min(RealtimeRoomTokens.MAX_TTL_SECONDS, Math.max(RealtimeRoomTokens.MIN_TTL_SECONDS, Math.floor(Number(ttlSeconds) || RealtimeRoomTokens.DEFAULT_TTL_SECONDS)));
    const payload = Buffer.from(JSON.stringify({ s: tenantId, r: room, e: Math.floor(Date.now() / 1000) + ttl })).toString('base64url');
    const signed = `${RealtimeRoomTokens.VERSION}.${payload}`;
    return `${signed}.${SigningSecretService.sign(await this.key(), signed)}`;
  }

  /** The site and room a token admits to, or null for anything forged, expired or malformed. */
  async verify(token: string): Promise<{ tenantId: string | null; room: string } | null> {
    const [version, payload, signature, extra] = String(token ?? '').split('.');
    if (version !== RealtimeRoomTokens.VERSION || !payload || !signature || extra !== undefined) return null;
    let claim: { s?: unknown; r?: unknown; e?: unknown };
    try {
      claim = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    } catch {
      return null;
    }
    const room = String(claim?.r ?? '');
    const tenantId = String(claim?.s ?? '').trim() || null;
    if (!RealtimeRoomTokens.ROOM_PATTERN.test(room) || !(Number(claim?.e) > Date.now() / 1000)) return null;
    if (TenantMode.isEnabled() && !tenantId) return null;
    const valid = await this.onSite(tenantId, async () => SigningSecretService.verify(await this.key(), `${version}.${payload}`, signature));
    return valid ? { tenantId: TenantMode.isEnabled() ? tenantId : null, room } : null;
  }

  private key(): Promise<string> {
    return SigningSecretService.signingKey(MetaContextProxy.createMetaProxy(this.manager), RealtimeRoomTokens.PURPOSE);
  }

  /** The signing key is the site's: read it inside that site's scope, as a request for it would. */
  private async onSite<T>(tenantId: string | null, work: () => Promise<T>): Promise<T> {
    if (!TenantMode.isEnabled() || !tenantId) return work();
    return RequestContextUtils.storage.run({ tenantId }, () => this.manager.db.withTenant(tenantId, work));
  }

  private static currentSite(): string | null {
    if (!TenantMode.isEnabled()) return null;
    const tenantId = String(RequestContextUtils.getTenantId() ?? '').trim();
    if (!tenantId) throw new Error('A realtime room belongs to a site; this code is not running for one');
    return tenantId;
  }
}

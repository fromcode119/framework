import { createECDH, createPrivateKey, sign } from 'node:crypto';
import { SecretService } from '@core/security/secret-service';
import type { IPluginContextMeta } from '@core/plugin/interfaces/plugin-context-meta.interface';

/**
 * The key pair a site signs its push messages with (VAPID, RFC 8292).
 *
 * A browser's subscription is bound to the PUBLIC key it was created with, and a push service only
 * delivers a message signed by the matching private key — so the pair is generated once per site, on
 * first use, and kept: replacing it orphans every device that ever subscribed. The private key is
 * stored encrypted whenever the server has a `SECRET_KEY` (as the signing root is) and never leaves
 * the api; the public key is what a browser subscribes with.
 */
export class PushSenderKeys {
  private static readonly PRIVATE_META_KEY = 'system:push_vapid_private';
  private static readonly PUBLIC_META_KEY = 'system:push_vapid_public';
  /** A push service refuses a signature valid for more than a day; twelve hours leaves room for clock drift. */
  private static readonly TOKEN_SECONDS = 12 * 3600;

  constructor(private readonly meta: IPluginContextMeta) {}

  /** The public key browsers subscribe with (uncompressed P-256 point, base64url). */
  async publicKey(): Promise<string> {
    return (await this.pair()).publicKey;
  }

  /** The `Authorization` header for one push service (`audience` = its origin), signed for `subject`. */
  async authorization(audience: string, subject: string): Promise<string> {
    const { privateKey, publicKey } = await this.pair();
    const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const unsigned = `${encode({ typ: 'JWT', alg: 'ES256' })}.${encode({ aud: audience, exp: Math.floor(Date.now() / 1000) + PushSenderKeys.TOKEN_SECONDS, sub: subject })}`;
    const point = Buffer.from(publicKey, 'base64url');
    const key = createPrivateKey({
      key: { kty: 'EC', crv: 'P-256', d: privateKey, x: point.subarray(1, 33).toString('base64url'), y: point.subarray(33, 65).toString('base64url') },
      format: 'jwk',
    });
    const signature = sign('sha256', Buffer.from(unsigned), { key, dsaEncoding: 'ieee-p1363' }).toString('base64url');
    return `vapid t=${unsigned}.${signature}, k=${publicKey}`;
  }

  private async pair(): Promise<{ privateKey: string; publicKey: string }> {
    const existing = await this.stored();
    if (existing) return existing;
    const ecdh = createECDH('prime256v1');
    ecdh.generateKeys();
    let privateValue = ecdh.getPrivateKey().toString('base64url');
    try {
      privateValue = SecretService.encrypt(privateValue);
    } catch {
      // No SECRET_KEY: stored as-is, the trust level the platform already gives its database then.
    }
    await this.meta.set(PushSenderKeys.PRIVATE_META_KEY, privateValue);
    await this.meta.set(PushSenderKeys.PUBLIC_META_KEY, ecdh.getPublicKey().toString('base64url'));
    // Two first uses can race; whichever pair landed is the one everybody uses from here.
    const created = await this.stored();
    if (!created) throw new Error('The push keys could not be stored');
    return created;
  }

  private async stored(): Promise<{ privateKey: string; publicKey: string } | null> {
    const privateKey = String(SecretService.decrypt(String((await this.meta.get(PushSenderKeys.PRIVATE_META_KEY)) ?? '')) ?? '').trim();
    const publicKey = String((await this.meta.get(PushSenderKeys.PUBLIC_META_KEY)) ?? '').trim();
    return privateKey && publicKey ? { privateKey, publicKey } : null;
  }
}

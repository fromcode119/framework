import { createPublicKey, KeyObject } from 'crypto';

/**
 * Fetches and caches JSON Web Key Sets (JWKS) for SSO providers (Google, Apple) and resolves a signing key
 * by `kid` into a Node `KeyObject` suitable for `jsonwebtoken.verify`. The JWK → public-key conversion uses
 * Node's built-in `crypto.createPublicKey({ format: 'jwk' })`, so no third-party JWK library is required.
 *
 * Keys are cached per JWKS URI with a TTL. A `kid` miss triggers a single refetch (providers rotate keys),
 * after which an unknown `kid` is treated as an invalid token.
 */
export class SsoJwksKeyProvider {
  private cache = new Map<string, { keys: Map<string, KeyObject>; fetchedAt: number }>();
  private readonly ttlMs = 6 * 60 * 60 * 1000; // 6h — providers publish long-lived signing keys

  async getKey(jwksUri: string, kid: string): Promise<KeyObject> {
    let entry = this.cache.get(jwksUri);
    if (!entry || Date.now() - entry.fetchedAt > this.ttlMs || !entry.keys.has(kid)) {
      entry = await this.refresh(jwksUri);
    }
    const key = entry.keys.get(kid);
    if (!key) {
      throw new Error('Unable to verify SSO token: signing key not found');
    }
    return key;
  }

  private async refresh(jwksUri: string): Promise<{ keys: Map<string, KeyObject>; fetchedAt: number }> {
    const res = await fetch(jwksUri);
    if (!res.ok) {
      throw new Error(`Failed to fetch SSO signing keys (${res.status})`);
    }
    const body: any = await res.json();
    const keys = new Map<string, KeyObject>();
    for (const jwk of Array.isArray(body?.keys) ? body.keys : []) {
      if (!jwk?.kid || jwk?.kty !== 'RSA') continue;
      try {
        keys.set(String(jwk.kid), createPublicKey({ key: jwk, format: 'jwk' }));
      } catch {
        // Skip malformed keys; a valid token's kid will still resolve.
      }
    }
    const entry = { keys, fetchedAt: Date.now() };
    this.cache.set(jwksUri, entry);
    return entry;
  }
}

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHmac } from 'crypto';
import { SigningContextProxy } from '@core/plugin/context/signing';
import { SigningSecretService } from '@core/security/signing-secret-service';

/**
 * `context.signing` signs on the host, under `<plugin slug>.<name>`.
 *
 * The purpose shape is load-bearing: it is exactly what every plugin passed to
 * `SigningSecretService.signingKey` before this existed, so moving a plugin onto it must not
 * invalidate a single link already sitting in someone's inbox.
 */
describe('context.signing', () => {
  const ROOT = 'r'.repeat(64);
  const store = new Map<string, string>([['system:signing_secret', ROOT]]);
  const manager: any = {
    db: { findOne: async (_table: string, where: { key: string }) => (store.has(where.key) ? { value: store.get(where.key) } : null) },
  };

  beforeEach(() => vi.restoreAllMocks());

  it('derives the same key a plugin derived for `<slug>.<name>`, so existing tokens still verify', async () => {
    const legacyKey = await SigningSecretService.signingKey(
      { get: async (k: string) => store.get(k) ?? null, set: async () => undefined } as any,
      'alpha.opt-out',
    );
    const legacySignature = SigningSecretService.sign(legacyKey, 'payload');

    const signing = SigningContextProxy.createSigningProxy(manager, 'alpha');
    expect(await signing.sign('opt-out', 'payload')).toBe(legacySignature);
    expect(await signing.verify('opt-out', 'payload', legacySignature)).toBe(true);
  });

  it('rejects a tampered message or signature', async () => {
    const signing = SigningContextProxy.createSigningProxy(manager, 'beta');
    const signature = await signing.sign('unsubscribe', 'a@example.com');
    expect(await signing.verify('unsubscribe', 'b@example.com', signature)).toBe(false);
    expect(await signing.verify('unsubscribe', 'a@example.com', `${signature.slice(0, -1)}${signature.endsWith('0') ? '1' : '0'}`)).toBe(false);
    expect(await signing.verify('unsubscribe', 'a@example.com', '')).toBe(false);
  });

  /** A plugin names only its own purposes: it cannot reach another plugin's key, or the framework's. */
  it('scopes the purpose to the calling plugin', async () => {
    const beta = SigningContextProxy.createSigningProxy(manager, 'beta');
    const other = SigningContextProxy.createSigningProxy(manager, 'mallory');
    const signature = await beta.sign('unsubscribe', 'a@example.com');
    expect(await other.verify('unsubscribe', 'a@example.com', signature)).toBe(false);

    const systemKey = createHmac('sha256', ROOT).update('fromcode.signing.v1|system.email-preferences').digest('hex');
    const forged = await other.sign('../system.email-preferences', 'a@example.com');
    expect(forged).not.toBe(SigningSecretService.sign(systemKey, 'a@example.com'));
  });

  it('refuses an empty name rather than signing under the bare plugin slug', async () => {
    const signing = SigningContextProxy.createSigningProxy(manager, 'beta');
    await expect(signing.sign('  ', 'x')).rejects.toThrow(/signing name is required/);
  });
});

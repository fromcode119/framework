import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EmailPreferencesTokenService } from '@fromcode119/core';
import { SystemEmailPreferencesTokenController } from '@api/controllers/system/system-email-preferences-token-controller';

const SECRET = 'a'.repeat(64);

// Only the KEY DERIVATION is stubbed — it reads an install secret out of `_system_meta`, which this
// test has no database for. Real signing, real verification, real controller logic.
vi.mock('@fromcode119/core', async (importOriginal) => {
  const original = await importOriginal<Record<string, any>>();
  class StubSigningSecretService extends original.SigningSecretService {
    static async signingKey(): Promise<string> { return SECRET; }
  }
  return { ...original, SigningSecretService: StubSigningSecretService };
});

/**
 * The token-authenticated half of the preferences surface.
 *
 * Most recipients have no account, so a link in the mail is the only way they can change what they
 * receive. That makes forgery the whole threat model, and makes ONE rule load-bearing above all others:
 * the address comes from the signed token and from nowhere else. An address accepted from the request
 * would let anyone unsubscribe — or resubscribe — a stranger by typing their address.
 */
describe('SystemEmailPreferencesTokenController', () => {
  let suppressed: Array<[string, string, string]>;
  let unsuppressed: Array<[string, string]>;

  const controller = (): SystemEmailPreferencesTokenController => {
    const manager = {
      db: { findOne: async () => null, insert: async () => undefined, update: async () => undefined },
      emailCategories: {
        list: () => [
          { key: 'review-invitation', labelKey: 'sp.review', descriptionKey: 'sp.reviewHelp', pluginSlug: 'social-proof' },
          { key: 'broadcast', labelKey: 'bc.broadcast', descriptionKey: 'bc.broadcastHelp', pluginSlug: 'broadcasts' },
        ],
        has: (key: string) => ['review-invitation', 'broadcast'].includes(key),
      },
      integrations: {
        email: {
          isSuppressed: async (_address: string, category: string) => category === 'broadcast',
          suppress: async (a: string, c: string, s: string) => { suppressed.push([a, c, s]); },
          unsuppress: async (a: string, c: string) => { unsuppressed.push([a, c]); },
        },
      },
    };
    return new SystemEmailPreferencesTokenController(manager as any, (_key: string, fallback: string) => fallback);
  };

  const response = () => {
    const res: any = {
      statusCode: 200,
      body: undefined,
      status(code: number) { this.statusCode = code; return this; },
      json(payload: unknown) { this.body = payload; return this; },
    };
    return res;
  };

  beforeEach(() => {
    suppressed = [];
    unsuppressed = [];
  });

  const validToken = () => EmailPreferencesTokenService.generate('holder@example.com', SECRET);

  it('lists every declared stream for a token that verifies', async () => {
    const res = response();
    await controller().list({ query: { token: validToken() } } as any, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.address).toBe('holder@example.com');
    expect(res.body.preferences.map((p: any) => p.key)).toEqual(['review-invitation', 'broadcast']);
  });

  /** `subscribed`, not `suppressed` — a toggle whose ON means "off" is how preference screens invert. */
  it('reports a suppressed stream as not subscribed', async () => {
    const res = response();
    await controller().list({ query: { token: validToken() } } as any, res);

    expect(res.body.preferences.find((p: any) => p.key === 'broadcast').subscribed).toBe(false);
    expect(res.body.preferences.find((p: any) => p.key === 'review-invitation').subscribed).toBe(true);
  });

  it('401s a forged token and touches the suppression list not at all', async () => {
    const res = response();
    await controller().list({ query: { token: 'forged.deadbeef' } } as any, res);

    expect(res.statusCode).toBe(401);
    expect(suppressed).toEqual([]);
    expect(unsuppressed).toEqual([]);
  });

  it('401s a missing token', async () => {
    const res = response();
    await controller().list({ query: {} } as any, res);
    expect(res.statusCode).toBe(401);
  });

  /**
   * The IDOR guard. This is the test that matters: the body names a victim, and the controller must
   * act on the token holder regardless.
   */
  it('acts on the address in the TOKEN, ignoring an address supplied by the caller', async () => {
    const res = response();
    await controller().update({
      body: { token: validToken(), address: 'victim@example.com', email: 'victim@example.com', key: 'broadcast', subscribed: false },
      query: {},
    } as any, res);

    expect(res.statusCode).toBe(200);
    expect(suppressed).toEqual([['holder@example.com', 'broadcast', 'email-preferences-link']]);
  });

  it('resubscribes through the same token', async () => {
    const res = response();
    await controller().update({
      body: { token: validToken(), key: 'broadcast', subscribed: true },
      query: {},
    } as any, res);

    expect(res.statusCode).toBe(200);
    expect(unsuppressed).toEqual([['holder@example.com', 'broadcast']]);
  });

  /** An unknown key would sit in the suppression list forever, muting a stream that does not exist. */
  it('refuses an unknown category', async () => {
    const res = response();
    await controller().update({
      body: { token: validToken(), key: 'not-a-stream', subscribed: false },
      query: {},
    } as any, res);

    expect(res.statusCode).toBe(400);
    expect(suppressed).toEqual([]);
  });
});

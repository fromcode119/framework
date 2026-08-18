import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EmailContextProxy } from '@core/plugin/context/email';
import { EmailPreferencesTokenService } from '@core/email/email-preferences-token-service';
import { SigningSecretService } from '@core/security/signing-secret-service';

/**
 * A plugin must be able to put a preferences link in its mail WITHOUT being able to mint one.
 *
 * The token is signed with the install's root secret. Exporting the token service to the SDK would let
 * any plugin forge a link for any address, so the framework mints it and the plugin only supplies an
 * address — the same shape as `notifications.notifyAdmins`, where the plugin supplies a message and
 * never resolves recipients.
 */
describe('context.email.buildPreferencesUrl', () => {
  const SECRET = 'a'.repeat(64);
  const manager: any = { integrations: { email: { send: async () => undefined } }, db: {} };
  const plugin: any = { manifest: { slug: 'epsilon' } };

  const email = () => EmailContextProxy.createEmailProxy(plugin, manager);

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(SigningSecretService, 'signingKey').mockResolvedValue(SECRET);
    process.env.FRONTEND_URL = 'https://shop.example.com';
  });

  it('builds a frontend link carrying a token that resolves back to the address', async () => {
    const url = await email().buildPreferencesUrl('Buyer@Example.COM');

    expect(url.startsWith('https://shop.example.com/unsubscribe?token=')).toBe(true);
    const token = decodeURIComponent(url.split('token=')[1]);
    expect(EmailPreferencesTokenService.resolveAddress(token, SECRET)).toBe('buyer@example.com');
  });

  it('never points at the API host', async () => {
    const url = await email().buildPreferencesUrl('buyer@example.com');
    expect(url).not.toContain('/api/');
  });

  it('returns empty for a blank address rather than a link to nobody', async () => {
    expect(await email().buildPreferencesUrl('')).toBe('');
    expect(await email().buildPreferencesUrl('   ')).toBe('');
  });

  /** A link that cannot be verified is worse than no link: the recipient clicks it and it fails. */
  it('returns empty when no signing key can be resolved, never an unsigned link', async () => {
    vi.spyOn(SigningSecretService, 'signingKey').mockRejectedValue(new Error('SIGNING_SECRET_UNAVAILABLE'));
    expect(await email().buildPreferencesUrl('buyer@example.com')).toBe('');
  });

  /** The driver is proxied, not wrapped — the addition must not shadow anything it already had. */
  it('leaves the underlying driver reachable', async () => {
    expect(typeof email().send).toBe('function');
  });
});

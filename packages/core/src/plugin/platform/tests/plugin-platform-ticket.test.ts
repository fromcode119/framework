import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PluginPlatformTicket } from '@core/plugin/platform/plugin-platform-ticket';
import { SecretService } from '@core/security/secret-service';

/**
 * The ticket is the only thing that tells a plugin's platform part whose an account is. It must open only
 * here, only for the plugin it was sealed for, and only until it expires — and a hand-made one never.
 */
describe('PluginPlatformTicket', () => {
  beforeEach(() => { process.env.SECRET_KEY = 'test-key-for-platform-ticket'; });
  afterEach(() => { delete process.env.SECRET_KEY; });

  const input = {
    slug: 'replies',
    tenantId: '42',
    userId: '7',
    returnTo: 'https://site.example/admin/replies',
    completeUrl: 'https://site.example/api/plugins/replies/connection/complete',
  };

  it('opens for the plugin it was sealed for, carrying the site, the account and the way back', () => {
    const opened = PluginPlatformTicket.open('replies', PluginPlatformTicket.mint(input));
    expect(opened).toMatchObject({ slug: 'replies', tenantId: '42', userId: '7', returnTo: input.returnTo, completeUrl: input.completeUrl });
  });

  it('gets a fresh nonce each time it is minted', () => {
    const first = PluginPlatformTicket.open('replies', PluginPlatformTicket.mint(input));
    const second = PluginPlatformTicket.open('replies', PluginPlatformTicket.mint(input));
    expect(first?.nonce).toMatch(/^[0-9a-f]{32}$/);
    expect(first?.nonce).not.toBe(second?.nonce);
  });

  it('refuses a sealed ticket that names no account (minted before tickets did)', () => {
    const { userId: _userId, completeUrl: _completeUrl, ...legacy } = input;
    const sealed = SecretService.encrypt(JSON.stringify({ ...legacy, exp: Date.now() + 60_000, nonce: 'abc' }));
    expect(PluginPlatformTicket.open('replies', Buffer.from(sealed, 'utf8').toString('base64url'))).toBeNull();
  });

  it('keeps an untenanted installation untenanted', () => {
    expect(PluginPlatformTicket.open('replies', PluginPlatformTicket.mint({ ...input, tenantId: null }))?.tenantId).toBeNull();
  });

  it('is refused by another plugin', () => {
    expect(PluginPlatformTicket.open('other', PluginPlatformTicket.mint(input))).toBeNull();
  });

  it('is refused once it has expired', () => {
    const now = Date.now();
    const ticket = PluginPlatformTicket.mint(input, now);
    expect(PluginPlatformTicket.open('replies', ticket, now + PluginPlatformTicket.LIFETIME_MS - 1)).not.toBeNull();
    expect(PluginPlatformTicket.open('replies', ticket, now + PluginPlatformTicket.LIFETIME_MS)).toBeNull();
  });

  it('refuses a ticket written by hand instead of sealed', () => {
    const forged = Buffer.from(JSON.stringify({ ...input, exp: Date.now() + 60_000, nonce: 'x' }), 'utf8').toString('base64url');
    expect(PluginPlatformTicket.open('replies', forged)).toBeNull();
  });

  it('refuses a ticket sealed with another installation\'s key', () => {
    const ticket = PluginPlatformTicket.mint(input);
    process.env.SECRET_KEY = 'another-installation-key';
    expect(PluginPlatformTicket.open('replies', ticket)).toBeNull();
  });

  it('refuses nothing at all and garbage', () => {
    expect(PluginPlatformTicket.open('replies', undefined)).toBeNull();
    expect(PluginPlatformTicket.open('replies', 'not-a-ticket')).toBeNull();
  });
});

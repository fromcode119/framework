import { describe, expect, it, vi } from 'vitest';
import { PluginMetaAccess } from '@core/plugin/context/plugin-meta-access';
import { SecretService } from '@core/security/secret-service';

/**
 * What `context.meta` lets a plugin reach in the framework's own key-value store. It holds the signing
 * root, two-step secrets, reset tokens and integration credentials, so the plugin-facing view refuses
 * the account and credential namespaces, masks secrets in keys the plugin does not own, and writes only
 * the plugin's own keys.
 */

const CIPHER = 'enc:v1:aXY=:dGFn:Y2lwaGVy';

function store(rows: Record<string, string>) {
  const meta = {
    get: vi.fn(async (key: string) => rows[key] ?? null),
    set: vi.fn(async () => undefined),
    advanceCounter: vi.fn(async () => 1),
  };
  return { meta, view: PluginMetaAccess.wrap(meta, 'shop') };
}

describe('context.meta reads', () => {
  it.each([
    ['system:signing_secret'], ['user:1:totp_secret'], ['user:1:2fa_enabled'], ['auth:password_reset_token:abc'],
    ['auth:api_token:abc'], ['scim:token'], ['mcp:anything'], [' User:1:totp_secret'],
  ])('refuses %s without reading it', async (key) => {
    const { meta, view } = store({});

    await expect(view.get(key)).rejects.toThrow(/belong to the framework/);
    expect(meta.get).not.toHaveBeenCalled();
  });

  it('hands over the plain fields of an integration and masks its secrets, however deeply nested', async () => {
    const providers = JSON.stringify({
      providers: [{ key: 'smtp', enabled: true, config: { fromEmail: 'shop@site.test', password: CIPHER, auth: { user: 'u', pass: CIPHER } } }],
    });
    const { view } = store({ integration_email_providers: providers });

    const read = JSON.parse(String(await view.get('integration_email_providers')));

    const config = read.providers[0].config;
    expect(config.fromEmail).toBe('shop@site.test');
    expect(config.auth.user).toBe('u');
    expect(config.password).toBe(SecretService.getSavedSecretMask());
    expect(config.auth.pass).toBe(SecretService.getSavedSecretMask());
    expect(JSON.stringify(read)).not.toContain('enc:v1:');
  });

  it('masks a platform credential stored as a bare ciphertext', async () => {
    const { view } = store({ certificate_acme_cloudflare_token: CIPHER });

    expect(await view.get('certificate_acme_cloudflare_token')).toBe(SecretService.getSavedSecretMask());
  });

  it('reads plain platform settings and the plugin’s own values unchanged — its own secrets too', async () => {
    const { view } = store({ site_name: 'My Shop', 'shop:token': CIPHER });

    expect(await view.get('site_name')).toBe('My Shop');
    expect(await view.get('shop:token')).toBe(CIPHER);
  });
});

describe('context.meta writes', () => {
  it('writes the plugin’s own keys, with either separator', async () => {
    const { meta, view } = store({});

    await view.set('shop:backfill_done', '1');
    await view.set('shop.mailbox.position', '{}');
    await view.advanceCounter('shop:order_seq', 100);

    expect(meta.set).toHaveBeenCalledTimes(2);
    expect(meta.advanceCounter).toHaveBeenCalledWith('shop:order_seq', 100, undefined);
  });

  it.each([
    ['site_url'], ['maintenance_mode'], ['integration_email_providers'], ['other-plugin:seq'], ['shopping:seq'],
    ['auth:password_reset_token:abc'], ['user:1:2fa_enabled'], ['system:signing_secret'],
  ])('refuses to write %s', async (key) => {
    const { meta, view } = store({});

    await expect(view.set(key, 'x')).rejects.toThrow(/refused/);
    await expect(view.advanceCounter(key)).rejects.toThrow(/refused/);
    expect(meta.set).not.toHaveBeenCalled();
    expect(meta.advanceCounter).not.toHaveBeenCalled();
  });
});

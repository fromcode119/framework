import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SettingsContextProxy } from '@core/plugin/context/settings';
import { SecretService } from '@core/security/secret-service';

/**
 * `context.settings` seals secret fields on the way in and must open them on the way out.
 *
 * The admin settings form encrypts every `password` field (and every field whose name says it is a
 * credential) when it saves. `get()` used to return those values as stored, so a plugin received
 * `enc:v1:…` and used it as the credential: a reCAPTCHA secret that could never verify, a webhook
 * signed with ciphertext, an unsubscribe secret that matched nothing.
 */
describe('context.settings — secret fields', () => {
  const previousKey = process.env.SECRET_KEY;
  const schema = {
    fields: [
      { name: 'apiEndpoint', type: 'text' },
      { name: 'webhookSecret', type: 'password' },
      { name: 'legacyAccessToken', type: 'text' },
    ],
  };

  beforeAll(() => { process.env.SECRET_KEY = 'k'.repeat(64); });
  afterAll(() => {
    if (previousKey === undefined) delete process.env.SECRET_KEY;
    else process.env.SECRET_KEY = previousKey;
  });

  function proxyOver(stored: Record<string, unknown>) {
    const row = { settings: { settings: stored } };
    const manager: any = {
      db: { findOne: async () => row },
      getPluginSettings: () => schema,
      registerPluginSettings: () => undefined,
      savePluginConfig: async (_slug: string, config: any) => { row.settings = config; },
      emit: () => undefined,
    };
    return SettingsContextProxy.createSettingsProxy({ manifest: { slug: 'alpha' } } as any, manager);
  }

  it('returns the plaintext of every sealed secret field, and leaves other fields alone', async () => {
    const settings = await proxyOver({
      apiEndpoint: 'https://api.example.test',
      webhookSecret: SecretService.encrypt('hook-secret'),
      legacyAccessToken: SecretService.encrypt('token-value'),
    }).get();

    expect(settings).toMatchObject({ apiEndpoint: 'https://api.example.test', webhookSecret: 'hook-secret', legacyAccessToken: 'token-value' });
  });

  it('round-trips: what update() seals, get() opens', async () => {
    const proxy = proxyOver({});
    await proxy.update({ webhookSecret: 'typed-by-operator', apiEndpoint: 'x' });
    expect(await proxy.get()).toMatchObject({ webhookSecret: 'typed-by-operator', apiEndpoint: 'x' });
  });

  it('passes a plaintext value stored before encryption existed through unchanged', async () => {
    expect(await proxyOver({ webhookSecret: 'old-plain' }).get()).toMatchObject({ webhookSecret: 'old-plain' });
  });

  it('returns empty — never ciphertext — for a value this server cannot open', async () => {
    const sealedElsewhere = SecretService.encryptWith('other-deployment', 'another-passphrase');
    expect(await proxyOver({ webhookSecret: sealedElsewhere }).get()).toMatchObject({ webhookSecret: '' });
  });
});

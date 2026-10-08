import { SecretsContextProxy } from '@core/plugin/context/secrets';
import { SecretService } from '@core/security/secret-service';

describe('a plugin\'s secrets', () => {
  const previous = process.env.SECRET_KEY;
  beforeAll(() => { process.env.SECRET_KEY = 'a-test-installation-key-of-enough-length'; });
  afterAll(() => { process.env.SECRET_KEY = previous; });

  it('are encrypted at rest and opened again by the plugin that stored them', async () => {
    const migrate = SecretsContextProxy.createSecretsProxy('migrate');
    expect(await migrate.isConfigured()).toBe(true);
    const stored = await migrate.encrypt('hunter2');
    expect(stored).not.toContain('hunter2');
    expect(await migrate.isEncrypted(stored)).toBe(true);
    expect(await migrate.decrypt(stored)).toBe('hunter2');
  });

  it('are not opened by another plugin, nor is a value the platform stored, nor plain text', async () => {
    const migrate = SecretsContextProxy.createSecretsProxy('migrate');
    const other = SecretsContextProxy.createSecretsProxy('other');
    await expect(other.decrypt(await migrate.encrypt('hunter2'))).rejects.toThrow('not encrypted by the plugin "other"');
    await expect(migrate.decrypt(SecretService.encrypt('integration-token'))).rejects.toThrow('not encrypted by the plugin "migrate"');
    await expect(migrate.decrypt('plain')).rejects.toThrow('not encrypted by the plugin');
    expect(await migrate.decrypt('')).toBe('');
  });
});

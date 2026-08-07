import { SecretService } from '@fromcode119/core';
import { PluginSettingsSupport } from '@api/controllers/plugins/plugin-settings-support';

const MASK = SecretService.getSavedSecretMask();
const FIELDS = [
  { name: 'tokenSecret', type: 'password' },
  { name: 'fromName', type: 'text' },
];

const support = () => new PluginSettingsSupport({} as any, { warn: () => {} } as any);

describe('PluginSettingsSupport.encryptPasswordFields', () => {
  beforeAll(() => {
    process.env.SECRET_KEY = process.env.SECRET_KEY || 'test-secret-key-at-least-32-characters-long';
  });

  it('keeps the stored secret when the admin submits the mask back untouched', () => {
    const result = support().encryptPasswordFields(
      { tokenSecret: MASK, fromName: 'Acme' },
      { tokenSecret: 'enc:v1:stored' },
      FIELDS,
    );

    expect(result.tokenSecret).toBe('enc:v1:stored');
  });

  it('keeps the stored secret when the field is not submitted at all', () => {
    const result = support().encryptPasswordFields(
      { fromName: 'Acme' },
      { tokenSecret: 'enc:v1:stored' },
      FIELDS,
    );

    expect(result.tokenSecret).toBe('enc:v1:stored');
  });

  it('CLEARS the stored secret when the operator deliberately empties the field', () => {
    for (const cleared of ['', '   ', null]) {
      const result = support().encryptPasswordFields(
        { tokenSecret: cleared, fromName: 'Acme' },
        { tokenSecret: 'enc:v1:stored' },
        FIELDS,
      );

      expect(result.tokenSecret).toBe('');
    }
  });

  it('encrypts a newly typed secret', () => {
    const result = support().encryptPasswordFields(
      { tokenSecret: 'brand-new-secret' },
      { tokenSecret: 'enc:v1:stored' },
      FIELDS,
    );

    expect(SecretService.isEncryptedValue(result.tokenSecret)).toBe(true);
    expect(SecretService.decrypt(result.tokenSecret)).toBe('brand-new-secret');
  });

  it('leaves an already-encrypted incoming value alone', () => {
    const encrypted = SecretService.encrypt('already');
    const result = support().encryptPasswordFields({ tokenSecret: encrypted }, {}, FIELDS);

    expect(result.tokenSecret).toBe(encrypted);
  });

  it('never returns a secret in the clear to the admin', () => {
    expect(support().maskPasswordFields({ tokenSecret: 'enc:v1:stored', fromName: 'Acme' }, FIELDS))
      .toEqual({ tokenSecret: MASK, fromName: 'Acme' });
  });

  it('reports an empty stored secret as empty, not as a mask the operator cannot clear', () => {
    expect(support().maskPasswordFields({ tokenSecret: '' }, FIELDS).tokenSecret).toBe('');
  });
});

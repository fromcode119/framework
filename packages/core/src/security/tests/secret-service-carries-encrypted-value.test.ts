import { beforeAll, describe, expect, it } from 'vitest';
import { SecretService } from '@core/security/secret-service';

/**
 * A settings row holds its secrets nested inside JSON, so asking whether the ROW's own value "is"
 * an encrypted value never sees them. An import preview needs the nested answer, to be able to say
 * that a secret arrived and cannot be read here.
 */
describe('SecretService.carriesEncryptedValue', () => {
  let encrypted: string;

  beforeAll(() => {
    process.env.SECRET_KEY = 'test-key-for-secret-service-unit-test';
    encrypted = SecretService.encrypt('a-password');
  });

  it('finds an encrypted value nested inside a JSON blob', () => {
    const row = JSON.stringify({ providers: [{ providerKey: 'alpha', config: { username: 'someone', password: encrypted } }] });
    expect(SecretService.carriesEncryptedValue(row)).toBe(true);
  });

  it('agrees with isEncryptedValue when the value stands alone', () => {
    expect(SecretService.isEncryptedValue(encrypted)).toBe(true);
    expect(SecretService.carriesEncryptedValue(encrypted)).toBe(true);
  });

  it('is false for a blob whose secrets are empty', () => {
    const row = JSON.stringify({ providers: [{ providerKey: 'alpha', config: { username: 'someone', password: '' } }] });
    expect(SecretService.carriesEncryptedValue(row)).toBe(false);
  });

  it('is false for empty and absent input rather than throwing', () => {
    expect(SecretService.carriesEncryptedValue('')).toBe(false);
    expect(SecretService.carriesEncryptedValue(null)).toBe(false);
    expect(SecretService.carriesEncryptedValue(undefined)).toBe(false);
  });
});

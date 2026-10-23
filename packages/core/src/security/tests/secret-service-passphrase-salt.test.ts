import { createCipheriv, createHash, randomBytes } from 'crypto';
import { describe, expect, it } from 'vitest';
import { SecretService } from '@core/security/secret-service';

/**
 * A transfer passphrase is typed by a person. Sealing under it must stretch it with a per-value salt, so the
 * same secret sealed twice never looks alike and a leaked archive cannot be opened with one dictionary pass.
 */
describe('SecretService passphrase seals', () => {
  it('salts every seal, so the same secret under the same passphrase never repeats', () => {
    const first = SecretService.encryptWith('sk_live_value', 'correct horse');
    const second = SecretService.encryptWith('sk_live_value', 'correct horse');
    expect(first).not.toBe(second);
    expect(first.split(':').length).toBe(6); // enc, v1, salt, iv, tag, data
    expect(SecretService.isEncryptedValue(first)).toBe(true);
  });

  it('opens a salted seal with the same passphrase and refuses another', () => {
    const sealed = SecretService.encryptWith('sk_live_value', 'correct horse');
    expect(SecretService.decryptWith(sealed, 'correct horse')).toBe('sk_live_value');
    expect(() => SecretService.decryptWith(sealed, 'wrong horse')).toThrow();
  });

  it('still opens an archive sealed before salting', () => {
    const key = createHash('sha256').update('correct horse').digest();
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const data = Buffer.concat([cipher.update('old secret', 'utf8'), cipher.final()]);
    const legacy = `enc:v1:${iv.toString('base64')}:${cipher.getAuthTag().toString('base64')}:${data.toString('base64')}`;
    expect(SecretService.decryptWith(legacy, 'correct horse')).toBe('old secret');
  });
});

import { afterEach, describe, expect, it } from 'vitest';
import { SecretService } from '@core/security/secret-service';
import { SecretTransitResealer } from '@core/security/secret-transit-resealer';

/**
 * The end of "the credentials arrived and cannot be read". A secret is encrypted with the key of the
 * deployment holding it; these tests move one from a source deployment's key to a target's, through
 * a passphrase, exactly as an archive would carry it.
 */
class Deployment {
  static as<T>(secretKey: string, run: () => T): T {
    const previous = process.env.SECRET_KEY;
    process.env.SECRET_KEY = secretKey;
    try {
      return run();
    } finally {
      if (previous === undefined) delete process.env.SECRET_KEY;
      else process.env.SECRET_KEY = previous;
    }
  }
}

describe('SecretTransitResealer', () => {
  afterEach(() => { delete process.env.SECRET_KEY; });

  const passphrase = 'a-transfer-passphrase';

  it('carries a secret from one deployment key to another', () => {
    const stored = Deployment.as('source-key', () => ({
      providers: [{ providerKey: 'alpha', config: { username: 'someone', password: SecretService.encrypt('hunter2') } }],
    }));

    const inTransit = Deployment.as('source-key', () => SecretTransitResealer.sealForTransit(stored, passphrase));
    const landed = Deployment.as('target-key', () => SecretTransitResealer.openFromTransit(inTransit, passphrase));

    const password = (landed as any).providers[0].config.password;
    expect(Deployment.as('target-key', () => SecretService.decrypt(password))).toBe('hunter2');
  });

  it('never leaves plaintext in the value that travels', () => {
    const stored = Deployment.as('source-key', () => ({ config: { password: SecretService.encrypt('hunter2') } }));
    const inTransit = Deployment.as('source-key', () => SecretTransitResealer.sealForTransit(stored, passphrase));
    expect(JSON.stringify(inTransit)).not.toContain('hunter2');
    expect(SecretService.isEncryptedValue((inTransit as any).config.password)).toBe(true);
  });

  it('is useless without the passphrase', () => {
    const stored = Deployment.as('source-key', () => ({ config: { password: SecretService.encrypt('hunter2') } }));
    const inTransit = Deployment.as('source-key', () => SecretTransitResealer.sealForTransit(stored, passphrase));
    expect(() => Deployment.as('target-key', () => SecretTransitResealer.openFromTransit(inTransit, 'the-wrong-passphrase'))).toThrow();
  });

  it('reseals a secret nested inside JSON held as a string', () => {
    const row = Deployment.as('source-key', () => JSON.stringify({ providers: [{ config: { pass: SecretService.encrypt('s3cret') } }] }));
    const inTransit = Deployment.as('source-key', () => SecretTransitResealer.sealForTransit(row, passphrase));
    expect(typeof inTransit).toBe('string');
    const landed = Deployment.as('target-key', () => SecretTransitResealer.openFromTransit(inTransit, passphrase));
    const parsed = JSON.parse(String(landed));
    expect(Deployment.as('target-key', () => SecretService.decrypt(parsed.providers[0].config.pass))).toBe('s3cret');
  });

  it('leaves a value carrying no secret exactly as written', () => {
    const row = { config: { username: 'someone', password: '' } };
    expect(SecretTransitResealer.sealForTransit(row, passphrase)).toEqual(row);
    expect(SecretTransitResealer.count(row)).toBe(0);
  });

  it('counts secrets without revealing one', () => {
    const stored = Deployment.as('source-key', () => ({
      a: SecretService.encrypt('one'),
      b: { c: SecretService.encrypt('two') },
    }));
    expect(SecretTransitResealer.count(stored)).toBe(2);
  });
});

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SecretService } from '@core/security/secret-service';
import { SecretTransitResealer } from '@core/security/secret-transit-resealer';

/** Swapping the env key is how a DIFFERENT deployment is simulated — there is no other difference. */
function withKey<T>(key: string, run: () => T): T {
  const previous = process.env.SECRET_KEY;
  process.env.SECRET_KEY = key;
  try {
    return run();
  } finally {
    if (previous === undefined) delete process.env.SECRET_KEY; else process.env.SECRET_KEY = previous;
  }
}

describe('SecretTransitResealer.readableHere', () => {
  const previous = process.env.SECRET_KEY;

  beforeEach(() => { process.env.SECRET_KEY = 'key-of-this-deployment'; });
  afterEach(() => { if (previous === undefined) delete process.env.SECRET_KEY; else process.env.SECRET_KEY = previous; });

  it('is true for a settings row this deployment encrypted itself', () => {
    const row = JSON.stringify({ providers: [{ id: 'courier', config: { username: SecretService.encrypt('a-user'), password: SecretService.encrypt('a-pass') } }] });
    expect(SecretTransitResealer.readableHere(row)).toBe(true);
  });

  it('is FALSE when the secret came from a deployment with a different key', () => {
    const foreign = withKey('key-of-the-other-deployment', () => JSON.stringify({ config: { password: SecretService.encrypt('a-pass') } }));
    expect(SecretTransitResealer.readableHere(foreign)).toBe(false);
  });

  it('is false when ANY secret in the row is unreadable, not only the first', () => {
    const mine = SecretService.encrypt('mine');
    const theirs = withKey('key-of-the-other-deployment', () => SecretService.encrypt('theirs'));
    expect(SecretTransitResealer.readableHere(JSON.stringify({ a: mine, b: theirs }))).toBe(false);
    expect(SecretTransitResealer.readableHere(JSON.stringify({ a: mine, b: mine }))).toBe(true);
  });

  it('is true for a value carrying no secret at all', () => {
    expect(SecretTransitResealer.readableHere(JSON.stringify({ host: 'smtp.example', port: 587 }))).toBe(true);
  });

  it('never returns plaintext — it answers only yes or no', () => {
    const row = JSON.stringify({ password: SecretService.encrypt('hunter2') });
    const answer = SecretTransitResealer.readableHere(row);
    expect(typeof answer).toBe('boolean');
    expect(JSON.stringify(answer)).not.toContain('hunter2');
  });
});

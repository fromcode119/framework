import jwt from 'jsonwebtoken';
import { describe, expect, it, vi } from 'vitest';
import { AuthManager } from '@fromcode119/auth';

/**
 * `isApiKey` marks a request the middleware authenticated from the x-api-key header. It used to be
 * honoured INSIDE a token too, where it exempted the token from the session check — so anyone able to
 * mint a token could make one no sign-out ever ends, and it passed `requireApiToken` as well.
 */
describe('AuthManager and the isApiKey claim', () => {
  const secret = 'test-secret-123';
  const user = { id: '1', email: 'a@x.test', roles: ['admin'] } as any;

  it('never mints the claim into a token', async () => {
    const auth = new AuthManager(secret);

    const token = await auth.generateToken({ ...user, isApiKey: true });

    expect((jwt.decode(token) as any).isApiKey).toBeUndefined();
  });

  it('holds a token that claims it to its session anyway, and strips the claim', async () => {
    const auth = new AuthManager(secret);
    const validator = vi.fn(async () => false);
    auth.setSessionValidator(validator);
    const forged = jwt.sign({ ...user, jti: 'j1', isApiKey: true }, secret, { algorithm: 'HS256' });

    await expect(auth.verifyToken(forged)).rejects.toThrow(/revoked|expired/i);
    expect(validator).toHaveBeenCalledWith('j1');
  });

  it('a live session still verifies, without the claim', async () => {
    const auth = new AuthManager(secret);
    auth.setSessionValidator(async () => true);
    const forged = jwt.sign({ ...user, jti: 'j1', isApiKey: true }, secret, { algorithm: 'HS256' });

    const decoded = await auth.verifyToken(forged);

    expect((decoded as any).isApiKey).toBeUndefined();
  });
});

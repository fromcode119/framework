import jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';
import { AuthManager } from '@fromcode119/auth';

/**
 * A grant is proof that the operator re-authenticated for ONE privileged act. It replaces holding the
 * password: the read-only override used to keep the account password in the admin's memory and send
 * it again in the record body on every save, where it was bcrypt-compared each time.
 *
 * Everything below is about the two ways a grant could be worth more than it should be — used outside
 * the scope it was minted for, or used as something other than a grant.
 */
describe('AuthManager scoped grant tokens', () => {
  const SECRET = 'test-secret-123';
  const claims = { userId: '7', purpose: 'read_only_override', scope: 'collection:orders:record:1086' };

  it('accepts a grant presented for exactly what it was minted for', async () => {
    const auth = new AuthManager(SECRET);
    const grant = await auth.generateGrantToken(claims);
    expect(await auth.verifyGrantToken(grant, claims)).toBe(true);
  });

  it('REFUSES a grant replayed against another record', async () => {
    const auth = new AuthManager(SECRET);
    const grant = await auth.generateGrantToken(claims);
    expect(await auth.verifyGrantToken(grant, { ...claims, scope: 'collection:orders:record:1087' })).toBe(false);
  });

  it('REFUSES a grant replayed against another collection', async () => {
    const auth = new AuthManager(SECRET);
    const grant = await auth.generateGrantToken(claims);
    expect(await auth.verifyGrantToken(grant, { ...claims, scope: 'collection:invoices:record:1086' })).toBe(false);
  });

  it('REFUSES another operator presenting it', async () => {
    const auth = new AuthManager(SECRET);
    const grant = await auth.generateGrantToken(claims);
    expect(await auth.verifyGrantToken(grant, { ...claims, userId: '8' })).toBe(false);
  });

  it('REFUSES a grant minted for a different purpose', async () => {
    const auth = new AuthManager(SECRET);
    const grant = await auth.generateGrantToken(claims);
    expect(await auth.verifyGrantToken(grant, { ...claims, purpose: 'delete_record' })).toBe(false);
  });

  it('REFUSES a grant signed with another deployment secret', async () => {
    const grant = await new AuthManager('other-secret').generateGrantToken(claims);
    expect(await new AuthManager(SECRET).verifyGrantToken(grant, claims)).toBe(false);
  });

  it('REFUSES an expired grant', async () => {
    const auth = new AuthManager(SECRET);
    const grant = await auth.generateGrantToken(claims, { expiresIn: '-1s' });
    expect(await auth.verifyGrantToken(grant, claims)).toBe(false);
  });

  /**
   * The one that would have been expensive: every token here is signed with the SAME secret, and
   * `verifyToken` used to refuse only `type === 'refresh'`. A grant — which any operator can mint by
   * typing their own password — would otherwise verify as a full ACCESS token.
   */
  it('REFUSES a grant presented as an access token', async () => {
    const auth = new AuthManager(SECRET);
    const grant = await auth.generateGrantToken(claims);
    await expect(auth.verifyToken(grant)).rejects.toThrow(/grant/i);
  });

  it('REFUSES a grant carrying a forged access-token shape', async () => {
    const auth = new AuthManager(SECRET);
    const forged = jwt.sign({ type: 'grant', id: '7', roles: ['admin'] }, SECRET, { algorithm: 'HS256' });
    await expect(auth.verifyToken(forged)).rejects.toThrow(/grant/i);
  });

  /** An ordinary access token carries no `type`, and must keep verifying — this is the regression edge. */
  it('still accepts an ordinary access token', async () => {
    const auth = new AuthManager(SECRET);
    const token = await auth.generateToken({ id: '7', email: 'a@x.test' } as any);
    expect((await auth.verifyToken(token)).id).toBe('7');
  });

  it('REFUSES an access token presented as a grant', async () => {
    const auth = new AuthManager(SECRET);
    const token = await auth.generateToken({ id: '7', email: 'a@x.test' } as any);
    expect(await auth.verifyGrantToken(token, claims)).toBe(false);
  });
});

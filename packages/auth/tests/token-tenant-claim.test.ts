import jwt from 'jsonwebtoken';
import { describe, expect, it, vi } from 'vitest';
import { AuthManager } from '@fromcode119/auth';

/**
 * A token must not be replayable against another tenant.
 *
 * Cookies are host-scoped, so a token cannot travel between tenant domains on its own — but nothing
 * stops it being REPLAYED against another tenant's API except checking the claim. A mismatch is
 * refused; it is never quietly re-scoped to whatever tenant the request resolved to.
 */
describe('AuthManager tenant claim', () => {
  const user = { id: '1', email: 'a@x.test' } as any;

  it('mints a token carrying the tenant it was issued for', async () => {
    const auth = new AuthManager('test-secret-123');
    const token = await auth.generateToken(user, { tenantId: 't1' });
    const decoded = await auth.verifyToken(token, { tenantId: 't1' });
    expect((decoded as any).tenantId).toBe('t1');
  });

  it('REFUSES a token minted for a different tenant', async () => {
    const auth = new AuthManager('test-secret-123');
    const token = await auth.generateToken(user, { tenantId: 't1' });
    await expect(auth.verifyToken(token, { tenantId: 't2' })).rejects.toThrow(/tenant/i);
  });

  it('refuses a token with NO tenant claim when a tenant is expected', async () => {
    const auth = new AuthManager('test-secret-123');
    const token = await auth.generateToken(user);
    await expect(auth.verifyToken(token, { tenantId: 't1' })).rejects.toThrow(/tenant/i);
  });

  it('single-tenant mode: a token with no claim still verifies when none is expected', async () => {
    const auth = new AuthManager('test-secret-123');
    const token = await auth.generateToken(user);
    await expect(auth.verifyToken(token)).resolves.toBeTruthy();
  });

  it('a tenant-claimed token still verifies when no tenant is expected (single-tenant fallback)', async () => {
    const auth = new AuthManager('test-secret-123');
    const token = await auth.generateToken(user, { tenantId: 't1' });
    await expect(auth.verifyToken(token)).resolves.toBeTruthy();
  });

  it('refuses a non-API token without a session id when session validation is enabled', async () => {
    const secret = 'test-secret-123';
    const auth = new AuthManager(secret);
    const validator = vi.fn().mockResolvedValue(true);
    auth.setSessionValidator(validator);
    const token = jwt.sign(user, secret, { algorithm: 'HS256' });

    await expect(auth.verifyToken(token)).rejects.toThrow(/session identifier/i);
    expect(validator).not.toHaveBeenCalled();
  });
});

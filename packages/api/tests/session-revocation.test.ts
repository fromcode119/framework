import { describe, expect, it, vi } from 'vitest';
import { AuthManager } from '@fromcode119/auth';
import { ServerAuthSetup } from '@api/server/server-auth-setup';

/**
 * A token stops working the moment its session is revoked — signing out, or an admin ending the
 * session — not when it expires. Checked through the REAL session validator `ServerAuthSetup` installs,
 * so a regression in either half (the lookup or the token check) fails here.
 */
describe('session revocation', () => {
  const setup = (sessions: Array<Record<string, unknown>>) => {
    const auth = new AuthManager('test-secret-123');
    const db: any = {
      eq: (_column: unknown, value: unknown) => ({ tokenId: value }),
      find: vi.fn(async (_table: unknown, options: { where: { tokenId: string } }) => sessions.filter((row) => row.tokenId === options.where.tokenId)),
    };
    new ServerAuthSetup(auth, db, { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as any).configure();
    return auth;
  };
  const inAnHour = () => new Date(Date.now() + 3_600_000).toISOString();

  it('accepts a token whose session is live', async () => {
    const auth = setup([{ tokenId: 'jti-1', isRevoked: false, expiresAt: inAnHour() }]);
    const token = await auth.generateToken({ id: '7', email: 'a@x.test', jti: 'jti-1' } as any);
    await expect(auth.verifyToken(token)).resolves.toMatchObject({ id: '7' });
  });

  it('refuses the same token once its session is revoked (signed out)', async () => {
    const sessions = [{ tokenId: 'jti-1', isRevoked: false, expiresAt: inAnHour() }];
    const auth = setup(sessions);
    const token = await auth.generateToken({ id: '7', email: 'a@x.test', jti: 'jti-1' } as any);
    sessions[0].isRevoked = true;
    await expect(auth.verifyToken(token)).rejects.toThrow(/revoked or expired/i);
  });

  it('refuses a token whose session expired, or was never recorded', async () => {
    const auth = setup([{ tokenId: 'jti-old', isRevoked: false, expiresAt: new Date(Date.now() - 1000).toISOString() }]);
    const expired = await auth.generateToken({ id: '7', email: 'a@x.test', jti: 'jti-old' } as any);
    const unknown = await auth.generateToken({ id: '7', email: 'a@x.test', jti: 'jti-forged' } as any);
    await expect(auth.verifyToken(expired)).rejects.toThrow(/revoked or expired/i);
    await expect(auth.verifyToken(unknown)).rejects.toThrow(/revoked or expired/i);
  });
});

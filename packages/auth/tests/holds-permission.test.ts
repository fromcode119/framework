import { describe, expect, it } from 'vitest';
import { AuthManager } from '@fromcode119/auth';

/**
 * `holdsPermission` answers the same question as `requirePermission`, for a route open to every member
 * that answers a manager more — and like it, holds nothing it cannot prove.
 */
describe('AuthManager.holdsPermission', () => {
  const checker = {
    hasPermissionForRoles: async (roles: string[], permission: string) => roles.includes('admin') && permission === 'system:manage',
    hasPermission: async () => false,
  };

  it('holds a permission one of the request\'s effective roles grants', async () => {
    const auth = new AuthManager('test-secret-123');
    auth.setPermissionChecker(checker as any);
    expect(await auth.holdsPermission({ user: { id: '1', roles: ['admin'] } }, ['system:manage'])).toBe(true);
    expect(await auth.holdsPermission({ user: { id: '2', roles: ['reviewer'] } }, ['system:manage'])).toBe(false);
  });

  it('holds nothing without a user or without a permission checker', async () => {
    const auth = new AuthManager('test-secret-123');
    expect(await auth.holdsPermission({ user: { id: '1', roles: ['admin'] } }, ['system:manage'])).toBe(false);
    auth.setPermissionChecker(checker as any);
    expect(await auth.holdsPermission({}, ['system:manage'])).toBe(false);
  });
});

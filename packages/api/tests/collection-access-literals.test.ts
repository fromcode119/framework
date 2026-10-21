import { afterEach, describe, expect, it, vi } from 'vitest';
import { CollectionAccessPolicyService } from '@api/services/collection-access-policy-service';

/**
 * An isolated plugin's `access.read` is a function in the plugin's own process, so every read of a
 * public collection — a page by its slug, a list of posts — called into that process to hear `true`.
 * A rule that is the same for every request may now be written as the value itself.
 */
describe('collection access declared as a constant', () => {
  const policy = new CollectionAccessPolicyService();
  const collection = (access: Record<string, unknown>): any => ({ slug: 'fcp_example_pages', fields: [], access });
  const ADMIN = { id: 1, roles: ['admin'] };

  afterEach(() => vi.unstubAllEnvs());

  it('`read: true` lets every reader in, and counts as declared where undeclared reads are refused', async () => {
    vi.stubEnv('ENFORCE_COLLECTION_READ_AUTHZ', 'true');
    await expect(policy.resolveReadConstraints(collection({ read: true }), { user: null })).resolves.toEqual({});
    await expect(policy.resolveReadConstraints(collection({}), { user: null })).rejects.toBeTruthy();
  });

  it('`read: false` refuses everyone but an administrator, as a rule returning false does', async () => {
    await expect(policy.resolveReadConstraints(collection({ read: false }), { user: null })).rejects.toBeTruthy();
    await expect(policy.resolveReadConstraints(collection({ read: false }), { user: { id: 3, roles: ['customer'] } })).rejects.toBeTruthy();
    await expect(policy.resolveReadConstraints(collection({ read: false }), { user: ADMIN })).resolves.toEqual({});
  });

  it('a constant answers writes the same way: `false` is administrators only, `true` is everyone', async () => {
    await expect(policy.ensureCreateAllowed(collection({ create: false }), { user: null })).rejects.toBeTruthy();
    await expect(policy.ensureCreateAllowed(collection({ create: false }), { user: ADMIN })).resolves.toBeUndefined();
    await expect(policy.ensureUpdateAllowed(collection({ update: true }), { user: null })).resolves.toBeUndefined();
  });

  it('a function rule is still asked, per request', async () => {
    const read = vi.fn().mockReturnValue({ status: 'published' });
    await expect(policy.resolveReadConstraints(collection({ read }), { user: null })).resolves.toEqual({ status: 'published' });
    expect(read).toHaveBeenCalledTimes(1);
  });
});

describe('collection with no access.read', () => {
  const policy = new CollectionAccessPolicyService();
  const undeclared: any = { slug: 'fcp_example_notes', fields: [], access: {} };

  afterEach(() => vi.unstubAllEnvs());

  it('is administrators-only by default, with the flag unset', async () => {
    vi.stubEnv('ENFORCE_COLLECTION_READ_AUTHZ', '');
    await expect(policy.resolveReadConstraints(undeclared, { user: null })).rejects.toMatchObject({ statusCode: 401 });
    await expect(policy.resolveReadConstraints(undeclared, { user: { id: 3, roles: ['customer'] } })).rejects.toMatchObject({ statusCode: 403 });
    await expect(policy.resolveReadConstraints(undeclared, { user: { id: 1, roles: ['admin'] } })).resolves.toEqual({});
  });

  it('is open only when the deployment sets ENFORCE_COLLECTION_READ_AUTHZ=false', async () => {
    vi.stubEnv('ENFORCE_COLLECTION_READ_AUTHZ', 'false');
    await expect(policy.resolveReadConstraints(undeclared, { user: null })).resolves.toEqual({});
  });

  it('a declared read: true stays public under the default', async () => {
    vi.stubEnv('ENFORCE_COLLECTION_READ_AUTHZ', '');
    await expect(policy.resolveReadConstraints({ ...undeclared, access: { read: true } }, { user: null })).resolves.toEqual({});
  });
});

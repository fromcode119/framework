import { describe, expect, it } from 'vitest';
import { CollectionAccessPolicyService } from '@api/services/collection-access-policy-service';

/**
 * A collection that declares `publicListing` keeps a visitor's generic reads to what each record's
 * Visibility lists in the catalogue, while a read of one record by an address key still finds it.
 */
describe('a declared publicListing', () => {
  const policy = new CollectionAccessPolicyService();
  const collection = (access: Record<string, unknown>): any => ({ slug: 'fcp_example_pages', fields: [], access, publicListing: { pinnedBy: ['id', 'slug', 'customPermalink'] } });

  it('limits a visitor list to the catalogue, rows without a value included', async () => {
    const rule: any = await policy.resolveReadConstraints(collection({ read: true }), { query: {}, user: null });
    expect(rule.visibility).toEqual({ $in: ['public', 'catalog_only'], $orNull: true });
  });

  it('finds one record by its slug or id whatever its Visibility', async () => {
    await expect(policy.resolveReadConstraints(collection({ read: true }), { query: { slug: 'thanks' }, user: null })).resolves.toEqual({ slug: 'thanks' });
    await expect(policy.resolveReadConstraints(collection({ read: true }), { params: { id: '7' }, query: {}, user: null })).resolves.toEqual({});
  });

  it('does not take a filter of several slugs as a pin', async () => {
    const rule: any = await policy.resolveReadConstraints(collection({ read: true }), { query: { slug: { in: 'a,b' } }, user: null });
    expect(rule.visibility).toBeDefined();
  });

  it('keeps a collection rule of its own alongside', async () => {
    const rule: any = await policy.resolveReadConstraints(collection({ read: () => ({ status: 'published' }) }), { query: {}, user: null });
    expect(rule).toMatchObject({ status: 'published', visibility: { $orNull: true } });
  });

  it('lets an administrator read every record', async () => {
    await expect(policy.resolveReadConstraints(collection({ read: true }), { query: {}, user: { id: 1, roles: ['admin'] } })).resolves.toEqual({});
  });

  it('changes nothing for a collection that declares none', async () => {
    await expect(policy.resolveReadConstraints({ slug: 'x', fields: [], access: { read: true } } as any, { query: {}, user: null })).resolves.toEqual({});
  });
});

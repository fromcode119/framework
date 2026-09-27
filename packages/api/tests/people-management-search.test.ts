import { describe, it, expect } from 'vitest';
import { PeopleManagementService } from '@api/services/people-management-service';

/** Newest first, as the table is read. */
const rows = Array.from({ length: 30 }, (_, i) => ({ id: 30 - i, first_name: `Person ${30 - i}`, email: `p${30 - i}@example.com`, phone: i === 29 ? '+359 88 111 2222' : null }));
const service = () => new PeopleManagementService({
  find: async (_table: string, options: any) => rows.slice(0, options?.limit ?? rows.length),
}, {} as any);

describe('PeopleManagementService.getPeople search', () => {
  it('finds an OLD person even with a small limit — the limit applies to the matches, not the read', async () => {
    const found = await service().getPeople({ q: 'p1@example.com', limit: 8 });
    expect(found.map((p: any) => p.id)).toEqual([1]);
  });

  it('searches phone numbers too', async () => {
    const found = await service().getPeople({ q: '111 2222', limit: 8 });
    expect(found.map((p: any) => p.id)).toEqual([1]);
  });

  it('caps the matches at the limit', async () => {
    expect(await service().getPeople({ q: 'example.com', limit: 5 })).toHaveLength(5);
  });
});

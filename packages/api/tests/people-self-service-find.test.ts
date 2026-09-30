import { PeopleSelfService } from '@api/services/people-self-service';

/**
 * A person belongs to a site. Where no site can own one — the platform scope — the console still asks
 * who is reading, and must be answered without creating a row: the insert failed row-level security
 * and turned every console load there into a 500.
 */
describe('PeopleSelfService.findSelf', () => {
  it('answers null and writes nothing when the reader has no person in this scope', async () => {
    const db = { findOne: vi.fn(async () => null), insert: vi.fn(), update: vi.fn() };
    expect(await new PeopleSelfService(db).findSelf({ id: 1, email: 'owner@example.test' })).toBeNull();
    expect(db.insert).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
  });

  it('finds the reader by account, then by email', async () => {
    const db = { findOne: vi.fn(async (_t: string, where: any) => (where.email ? { id: 7, preferred_locale: 'bg' } : null)) };
    expect(await new PeopleSelfService(db).findSelf({ id: 1, email: 'Owner@Example.test' })).toEqual({ id: 7, preferredLocale: 'bg' });
  });
});

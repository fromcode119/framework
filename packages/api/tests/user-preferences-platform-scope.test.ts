import { RequestContextUtils } from '@fromcode119/core';
import { UserPreferencesService } from '@api/services/user-preferences-service';

/**
 * A preference saved in the platform scope is the platform's own row, which row-level security
 * accepts only inside a platform-admin write. Without that bracket every save there failed and a
 * dashboard arranged in the platform scope reset on the next load.
 */

function fakeDb() {
  const calls: string[] = [];
  const db: any = {
    findOne: vi.fn(async () => null),
    insert: vi.fn(async () => { calls.push(db.inBracket ? 'insert:platform-admin' : 'insert'); return true; }),
    update: vi.fn(async () => true),
    inBracket: false,
    withPlatformAdmin: vi.fn(async (fn: () => Promise<unknown>) => { db.inBracket = true; try { return await fn(); } finally { db.inBracket = false; } }),
  };
  return { db, calls };
}

afterEach(() => vi.restoreAllMocks());

describe('saving a preference', () => {
  it('outside a site, writes the platform row inside a platform-admin write', async () => {
    vi.spyOn(RequestContextUtils, 'getTenantId').mockReturnValue(null as any);
    const { db, calls } = fakeDb();
    expect(await new UserPreferencesService(db).set(7, 'dashboard.layout', { order: ['a'] })).toEqual({ success: true });
    expect(db.withPlatformAdmin).toHaveBeenCalledTimes(1);
    expect(calls).toEqual(['insert:platform-admin']);
  });

  it('inside a site, writes the site row with no platform-admin write', async () => {
    vi.spyOn(RequestContextUtils, 'getTenantId').mockReturnValue('shop' as any);
    const { db, calls } = fakeDb();
    expect(await new UserPreferencesService(db).set(7, 'dashboard.layout', { order: ['a'] })).toEqual({ success: true });
    expect(db.withPlatformAdmin).not.toHaveBeenCalled();
    expect(calls).toEqual(['insert']);
  });

  it('still refuses a key outside the preference namespace rules', async () => {
    const { db } = fakeDb();
    expect(await new UserPreferencesService(db).set(7, '../other', 1)).toEqual({ success: false, error: 'invalid_key' });
    expect(db.insert).not.toHaveBeenCalled();
  });
});

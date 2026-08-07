import { describe, expect, it, vi } from 'vitest';
import { PeopleDirectoryService } from '@core/plugin/services/people-directory-service';

/**
 * Harness mirroring the real wiring: a plugin-scoped `find` over one table, a `_system_meta` cursor
 * store, and the people proxy's `match`/`upsert`.
 */
function makeHarness(rows: any[], seedPeople: any[] = [], seedCursor?: string) {
  const people = [...seedPeople];
  const metaStore = new Map<string, string>();
  if (seedCursor != null) metaStore.set('people.directory.cursor.demo.@demo/rows', seedCursor);
  let nextId = people.reduce((m, p) => Math.max(m, Number(p.id) || 0), 0);

  const pluginDb = {
    find: vi.fn(async (_table: string, options: any) => {
      const after = Number(options?.where?.id?.gt ?? 0);
      return rows
        .filter((r) => Number(r.id) > after)
        .sort((a, b) => Number(a.id) - Number(b.id))
        .slice(0, Number(options?.limit ?? 500));
    }),
  };

  const meta = {
    get: vi.fn(async (key: string) => metaStore.get(key) ?? null),
    set: vi.fn(async (key: string, value: unknown) => { metaStore.set(key, String(value)); }),
  };

  const match = vi.fn(async ({ userId, email, phone }: any) => {
    if (userId != null && userId !== '') {
      const byUser = people.find((p) => String(p.userId) === String(userId));
      if (byUser) return byUser;
    }
    if (email) {
      const byEmail = people.find((p) => p.email === email);
      if (byEmail) return byEmail;
    }
    if (phone) {
      const byPhone = people.find((p) => p.phone === phone);
      if (byPhone) return byPhone;
    }
    return null;
  });

  const upsert = vi.fn(async (input: any) => {
    let hit: any = null;
    if (input.userId != null && input.userId !== '') hit = people.find((p) => String(p.userId) === String(input.userId));
    if (!hit && input.email) hit = people.find((p) => p.email === input.email);
    if (hit) { Object.assign(hit, input); return hit; }
    const created = { id: ++nextId, ...input };
    people.push(created);
    return created;
  });

  const service = new PeopleDirectoryService('demo', pluginDb, meta, match, upsert);
  return { service, people, pluginDb, meta, metaStore, match, upsert };
}

describe('PeopleDirectoryService.mergeFillEmpty', () => {
  it('fills only EMPTY existing fields and never overwrites a non-empty one', () => {
    const merged = PeopleDirectoryService.mergeFillEmpty(
      { id: 2, userId: null, firstName: 'К', lastName: '', source: 'astrology' },
      { userId: 1, firstName: 'Ignored', lastName: 'Д', source: 'finance' },
    );
    expect(merged.userId).toBe(1);
    expect(merged.firstName).toBe('К');
    expect(merged.lastName).toBe('Д');
    expect(merged.source).toBe('astrology');
  });

  it('treats a whitespace-only existing value as empty', () => {
    expect(PeopleDirectoryService.mergeFillEmpty({ lastName: '   ' }, { lastName: 'Real' }).lastName).toBe('Real');
  });

  it('never introduces a key the incoming payload did not carry', () => {
    const merged = PeopleDirectoryService.mergeFillEmpty({ phone: '0888', bio: 'kept elsewhere' }, { email: 'a@x.com' });
    expect(Object.keys(merged)).toEqual(['email']);
  });
});

describe('PeopleDirectoryService.withCleanUserId', () => {
  it('drops a blank userId so it never reaches the people.user_id FK', () => {
    expect(PeopleDirectoryService.withCleanUserId({ userId: '', email: 'a@x.com' })).toEqual({ email: 'a@x.com' });
    expect(PeopleDirectoryService.withCleanUserId({ userId: '  ', email: 'a@x.com' })).toEqual({ email: 'a@x.com' });
    expect(PeopleDirectoryService.withCleanUserId({ userId: null, email: 'a@x.com' })).toEqual({ email: 'a@x.com' });
  });

  it('keeps a real userId', () => {
    expect(PeopleDirectoryService.withCleanUserId({ userId: 5, email: 'a@x.com' })).toEqual({ userId: 5, email: 'a@x.com' });
  });
});

describe('PeopleDirectoryService.isIngestable', () => {
  it('accepts any of email / userId / phone as an anchor', () => {
    expect(PeopleDirectoryService.isIngestable({ email: 'a@x.com' })).toBe(true);
    expect(PeopleDirectoryService.isIngestable({ userId: 4 })).toBe(true);
    expect(PeopleDirectoryService.isIngestable({ phone: '0888' })).toBe(true);
  });

  it('accepts a bare name — a relative stripped of a shared email is still a person', () => {
    expect(PeopleDirectoryService.isIngestable({ email: '', userId: '', displayName: 'Мария Петрова' })).toBe(true);
  });

  it('rejects a payload describing nobody', () => {
    expect(PeopleDirectoryService.isIngestable({ email: '', userId: '', displayName: '  ' })).toBe(false);
    expect(PeopleDirectoryService.isIngestable({})).toBe(false);
  });
});

describe('PeopleDirectoryService.ingest', () => {
  it('merges into an existing same-email person instead of duplicating', async () => {
    const { service, people } = makeHarness([], [
      { id: 2, userId: null, email: 'k@x.com', firstName: 'Кристиян', lastName: '', source: 'astrology' },
    ]);
    const person = await service.ingest({ userId: 1, email: 'k@x.com', firstName: 'Ignored', lastName: 'Димитров', source: 'finance' });
    expect(people).toHaveLength(1);
    expect(person!.id).toBe(2);
    expect(people[0].userId).toBe(1);
    expect(people[0].firstName).toBe('Кристиян');
    expect(people[0].lastName).toBe('Димитров');
    expect(people[0].source).toBe('astrology');
  });

  it('returns null and writes nothing for a payload with no identity at all', async () => {
    const { service, people, upsert } = makeHarness([], []);
    expect(await service.ingest({ email: '', userId: '', displayName: '' })).toBeNull();
    expect(upsert).not.toHaveBeenCalled();
    expect(people).toHaveLength(0);
  });

  it('skips the match entirely for an unanchored payload so a relative stays distinct', async () => {
    const { service, people, match } = makeHarness([], [{ id: 1, email: 'shared@x.com', displayName: 'Child' }]);
    await service.ingest({ email: '', userId: '', displayName: 'Mother', birthDate: '1960-01-01' });
    expect(match).not.toHaveBeenCalled();
    expect(people).toHaveLength(2);
  });
});

describe('PeopleDirectoryService.sync', () => {
  const map = (row: any) => ({ email: String(row.email || '').toLowerCase(), displayName: row.name || '', source: 'demo' });

  it('reads only rows after the cursor — never the whole table', async () => {
    const rows = [
      { id: 1, email: 'old@x.com', name: 'Old' },
      { id: 2, email: 'new@x.com', name: 'New' },
    ];
    const { service, people, pluginDb } = makeHarness(rows, [], '1');
    const added = await service.sync('@demo/rows', map);
    expect(pluginDb.find).toHaveBeenCalledWith('@demo/rows', { where: { id: { gt: 1 } }, orderBy: { id: 'asc' }, limit: 500 });
    expect(added).toBe(1);
    expect(people.map((p) => p.email)).toEqual(['new@x.com']);
  });

  it('advances the cursor to the highest id it saw', async () => {
    const { service, metaStore } = makeHarness([{ id: 7, email: 'a@x.com', name: 'A' }]);
    await service.sync('@demo/rows', map);
    expect(metaStore.get('people.directory.cursor.demo.@demo/rows')).toBe('7');
  });

  it('is a no-op on the second run — the whole point of the cursor', async () => {
    const rows = [{ id: 1, email: 'a@x.com', name: 'A' }];
    const { service, pluginDb, upsert } = makeHarness(rows);
    expect(await service.sync('@demo/rows', map)).toBe(1);
    upsert.mockClear();
    expect(await service.sync('@demo/rows', map)).toBe(0);
    expect(upsert).not.toHaveBeenCalled();
    expect(pluginDb.find).toHaveBeenCalledTimes(2);
  });

  it('advances past a row that describes nobody rather than retrying it forever', async () => {
    const { service, metaStore, people } = makeHarness([{ id: 4, email: '', name: '' }]);
    expect(await service.sync('@demo/rows', map)).toBe(0);
    expect(people).toHaveLength(0);
    expect(metaStore.get('people.directory.cursor.demo.@demo/rows')).toBe('4');
  });

  it('leaves the cursor alone when there is nothing new', async () => {
    const { service, meta } = makeHarness([]);
    expect(await service.sync('@demo/rows', map)).toBe(0);
    expect(meta.set).not.toHaveBeenCalled();
  });

  it('awaits an async map so a plugin can consult its own table per row', async () => {
    const { service, people } = makeHarness([{ id: 1, email: 'a@x.com', name: 'A' }]);
    const added = await service.sync('@demo/rows', async (row: any) => ({ ...map(row), phone: '0888' }));
    expect(added).toBe(1);
    expect(people[0].phone).toBe('0888');
  });

  it('dedups repeated identities in one pass into a single person', async () => {
    const rows = [
      { id: 1, email: 'repeat@x.com', name: 'Repeat Buyer' },
      { id: 2, email: 'repeat@x.com', name: 'Repeat Buyer' },
    ];
    const { service, people } = makeHarness(rows);
    expect(await service.sync('@demo/rows', map)).toBe(2);
    expect(people).toHaveLength(1);
  });
});

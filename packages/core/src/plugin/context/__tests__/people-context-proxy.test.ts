import { describe, expect, it, vi } from 'vitest';
import { PeopleContextProxy } from '../people';

function makeManager(rows: any[] = []) {
  const store = [...rows];
  const db = {
    store,
    find: vi.fn(async (_t: string, opts?: any) => {
      const where = opts?.where ?? {};
      return store.filter((r) => Object.entries(where).every(([k, v]) => r[k] === v));
    }),
    findOne: vi.fn(async (_t: string, where: any) =>
      store.find((r) => Object.entries(where).every(([k, v]) => r[k] === v)) ?? null),
    insert: vi.fn(async (_t: string, data: any) => { const row = { id: store.length + 1, ...data }; store.push(row); return row; }),
    update: vi.fn(async (_t: string, where: any, data: any) => {
      const row = store.find((r) => Object.entries(where).every(([k, v]) => r[k] === v));
      if (!row) return null;
      Object.assign(row, data);
      return row;
    })
  };
  return { db } as any;
}

describe('PeopleContextProxy.match', () => {
  it('resolves by userId first', async () => {
    const mgr = makeManager([{ id: 7, userId: 42, email: 'a@b.com' }]);
    const people = PeopleContextProxy.createPeopleProxy({} as any, mgr);
    const found = await people.match({ userId: 42, email: 'other@x.com' });
    expect(found?.id).toBe(7);
    expect(mgr.db.findOne).toHaveBeenCalledWith('people', { userId: 42 });
  });

  it('falls back to case-folded email when no userId match', async () => {
    const mgr = makeManager([{ id: 9, email: 'person@x.com' }]);
    const people = PeopleContextProxy.createPeopleProxy({} as any, mgr);
    const found = await people.match({ email: 'Person@X.com' });
    expect(found?.id).toBe(9);
  });

  it('falls back to phone when no userId or email match', async () => {
    const mgr = makeManager([{ id: 3, phone: '+359888' }]);
    const people = PeopleContextProxy.createPeopleProxy({} as any, mgr);
    const found = await people.match({ phone: '+359888' });
    expect(found?.id).toBe(3);
  });

  it('returns null when nothing matches', async () => {
    const mgr = makeManager([]);
    const people = PeopleContextProxy.createPeopleProxy({} as any, mgr);
    expect(await people.match({ email: 'none@x.com' })).toBeNull();
  });
});

describe('PeopleContextProxy.upsert', () => {
  it('inserts a new person when no match', async () => {
    const mgr = makeManager([]);
    const people = PeopleContextProxy.createPeopleProxy({} as any, mgr);
    const p = await people.upsert({ email: 'New@X.com', firstName: 'New' });
    expect(mgr.db.insert).toHaveBeenCalledTimes(1);
    expect(p.email).toBe('new@x.com'); // email is stored case-folded
  });

  it('updates an existing matched person', async () => {
    const mgr = makeManager([{ id: 5, email: 'dup@x.com', firstName: 'Old' }]);
    const people = PeopleContextProxy.createPeopleProxy({} as any, mgr);
    const p = await people.upsert({ email: 'dup@x.com', firstName: 'Fresh' });
    expect(mgr.db.insert).not.toHaveBeenCalled();
    expect(mgr.db.update).toHaveBeenCalled();
    expect(p.id).toBe(5);
  });
});

describe('PeopleContextProxy.upsert blank userId', () => {
  it('does NOT write a blank userId (would violate the user_id FK)', async () => {
    const mgr = makeManager([]);
    const people = PeopleContextProxy.createPeopleProxy({} as any, mgr);
    await people.upsert({ email: 'x@y.com', userId: '' });
    const insertArg = mgr.db.insert.mock.calls[0][1];
    expect('userId' in insertArg).toBe(false);
  });

  it('keeps a real userId', async () => {
    const mgr = makeManager([]);
    const people = PeopleContextProxy.createPeopleProxy({} as any, mgr);
    await people.upsert({ email: 'real@y.com', userId: 5 });
    const insertArg = mgr.db.insert.mock.calls[0][1];
    expect(insertArg.userId).toBe(5);
  });
});

describe('PeopleContextProxy.linkAccount', () => {
  it('sets userId on an existing person row', async () => {
    const mgr = makeManager([{ id: 11, email: 'u@x.com' }]);
    const people = PeopleContextProxy.createPeopleProxy({} as any, mgr);
    await people.linkAccount(11, 99);
    expect(mgr.db.update).toHaveBeenCalledWith('people', { id: 11 }, expect.objectContaining({ userId: 99 }));
  });
});

describe('PeopleContextProxy.addRelationship / listRelated', () => {
  it('addRelationship inserts an edge', async () => {
    const mgr = makeManager([]);
    const people = PeopleContextProxy.createPeopleProxy({} as any, mgr);
    await people.addRelationship(1, 2, 'family.child', { note: 'x' });
    expect(mgr.db.insert).toHaveBeenCalledWith('person_relationships', expect.objectContaining({
      fromPersonId: 1, toPersonId: 2, type: 'family.child'
    }));
  });

  it('listRelated filters edges by from person (and type when given)', async () => {
    const mgr = makeManager([]);
    mgr.db.find = vi.fn(async () => [{ id: 1, fromPersonId: 1, toPersonId: 2, type: 'family.child' }]);
    const people = PeopleContextProxy.createPeopleProxy({} as any, mgr);
    const edges = await people.listRelated(1, 'family.child');
    expect(edges).toHaveLength(1);
    expect(mgr.db.find).toHaveBeenCalledWith('person_relationships', { where: { fromPersonId: 1, type: 'family.child' } });
  });
});

import { describe, expect, it, vi } from 'vitest';
import { PeopleAddressService } from '../people-address-service';

function makeDb(seed: { people?: any[]; addresses?: any[] } = {}) {
  const people = [...(seed.people ?? [])];
  const addresses = [...(seed.addresses ?? [])];
  let addrAutoId = addresses.reduce((m, a) => Math.max(m, Number(a.id) || 0), 0);
  let personAutoId = people.reduce((m, p) => Math.max(m, Number(p.id) || 0), 0);
  const tableOf = (t: string) => (t === 'people' ? people : addresses);

  const db = {
    people,
    addresses,
    find: vi.fn(async (t: string, opts?: any) => {
      const where = opts?.where ?? {};
      return tableOf(t).filter((r) => Object.entries(where).every(([k, v]) => r[k] === v));
    }),
    findOne: vi.fn(async (t: string, where: any) =>
      tableOf(t).find((r) => Object.entries(where).every(([k, v]) => r[k] === v)) ?? null),
    insert: vi.fn(async (t: string, data: any) => {
      const id = t === 'people' ? ++personAutoId : ++addrAutoId;
      const row = { id, ...data };
      tableOf(t).push(row);
      return row;
    }),
    update: vi.fn(async (t: string, where: any, data: any) => {
      const row = tableOf(t).find((r) => Object.entries(where).every(([k, v]) => r[k] === v));
      if (!row) return null;
      Object.assign(row, data);
      return row;
    }),
    delete: vi.fn(async (t: string, where: any) => {
      const arr = tableOf(t);
      const idx = arr.findIndex((r) => Object.entries(where).every(([k, v]) => r[k] === v));
      if (idx >= 0) arr.splice(idx, 1);
    })
  };
  return db as any;
}

describe('PeopleAddressService.upsert', () => {
  it('creates a minimal person from email when none exists, and makes first address default', async () => {
    const db = makeDb();
    const svc = new PeopleAddressService(db);
    const saved = await svc.upsert({ email: 'New@X.com' }, { fullName: 'A', addressLine1: 'L1', city: 'Sofia' });
    expect(db.insert).toHaveBeenCalledWith('people', expect.objectContaining({ email: 'new@x.com', source: 'contact' }));
    expect(saved.isDefault).toBe(true);
    expect(saved.personId).toBe(1);
  });

  it('rejects a fully anonymous ref (no userId/email)', async () => {
    const db = makeDb();
    const svc = new PeopleAddressService(db);
    await expect(svc.upsert({}, { fullName: 'A', addressLine1: 'L1', city: 'X' })).rejects.toThrow();
  });

  it('enforces a single default — setting a new default clears the old', async () => {
    const db = makeDb({ people: [{ id: 5, email: 'u@x.com' }] });
    const svc = new PeopleAddressService(db);
    const first = await svc.upsert({ email: 'u@x.com' }, { fullName: 'A', addressLine1: 'L1', city: 'X' });
    const second = await svc.upsert({ email: 'u@x.com' }, { fullName: 'B', addressLine1: 'L2', city: 'X', isDefault: true });
    const list = await svc.list({ email: 'u@x.com' });
    expect(list.filter((a) => a.isDefault)).toHaveLength(1);
    expect(list.find((a) => a.isDefault)?.id).toBe(second.id);
    expect(first.id).not.toBe(second.id);
  });

  it('updates an owned address by id without creating a new row', async () => {
    const db = makeDb({ people: [{ id: 5, email: 'u@x.com' }] });
    const svc = new PeopleAddressService(db);
    const created = await svc.upsert({ email: 'u@x.com' }, { fullName: 'A', addressLine1: 'L1', city: 'X' });
    await svc.upsert({ email: 'u@x.com' }, { id: created.id, fullName: 'A2', addressLine1: 'L1b', city: 'X' });
    const list = await svc.list({ email: 'u@x.com' });
    expect(list).toHaveLength(1);
    expect(list[0].fullName).toBe('A2');
  });

  it('stores metadata blob when provided', async () => {
    const db = makeDb({ people: [{ id: 5, email: 'u@x.com' }] });
    const svc = new PeopleAddressService(db);
    const saved = await svc.upsert({ email: 'u@x.com' }, { fullName: 'A', addressLine1: 'L1', city: 'X', metadata: { pointCode: '1010' } });
    expect(saved.metadata).toEqual({ pointCode: '1010' });
  });
});

describe('PeopleAddressService.delete', () => {
  it('promotes another address to default when the default is removed', async () => {
    const db = makeDb({ people: [{ id: 5, email: 'u@x.com' }] });
    const svc = new PeopleAddressService(db);
    const a = await svc.upsert({ email: 'u@x.com' }, { fullName: 'A', addressLine1: 'L1', city: 'X' }); // default
    await svc.upsert({ email: 'u@x.com' }, { fullName: 'B', addressLine1: 'L2', city: 'X' });
    await svc.delete(a.id);
    const list = await svc.list({ email: 'u@x.com' });
    expect(list).toHaveLength(1);
    expect(list[0].isDefault).toBe(true);
  });
});

describe('PeopleAddressService.setDefault', () => {
  it('rejects setting default on an address owned by a different person', async () => {
    const db = makeDb({ people: [{ id: 1, email: 'a@x.com' }, { id: 2, email: 'b@x.com' }] });
    const svc = new PeopleAddressService(db);
    const ownedByA = await svc.upsert({ email: 'a@x.com' }, { fullName: 'A', addressLine1: 'L1', city: 'X' });
    const result = await svc.setDefault({ email: 'b@x.com' }, ownedByA.id);
    expect(result).toBeNull();
  });
});

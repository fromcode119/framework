import { describe, it, expect, beforeEach } from 'vitest';
import { PlatformOwnershipService } from '@core/tenant/platform-ownership-service';
import { PlatformOwnershipError } from '@core/tenant/platform-ownership-error';

/** The status is part of the refusal, so it is asserted rather than inferred from the wording. */
const refusal = async (run: Promise<unknown>): Promise<PlatformOwnershipError> => {
  try {
    await run;
  } catch (error) {
    return error as PlatformOwnershipError;
  }
  throw new Error('expected the transfer to be refused');
};

/**
 * A stand-in for the RAW database manager: snake_case columns, and `withExclusiveLock` running the
 * callback straight through so the ordering inside a transfer is what is actually under test.
 */
class FakeDb {
  rows: any[];
  junction: any[] = [];

  constructor(rows: any[]) {
    this.rows = rows;
  }

  async find(_table: string, options: any) {
    const wanted = options?.where?.is_platform_admin;
    return this.rows.filter(row => row.is_platform_admin === wanted);
  }

  async findOne(_table: string, where: any) {
    return this.rows.find(row => row.id === where.id) ?? null;
  }

  async update(_table: string, where: any, data: any) {
    const row = this.rows.find(candidate => candidate.id === where.id);
    if (row) Object.assign(row, data);
    return row;
  }

  async insert(_table: string, data: any) {
    this.junction.push(data);
    return data;
  }

  async withExclusiveLock<T>(_name: string, fn: () => Promise<T>): Promise<T> {
    return fn();
  }

  owner() {
    return this.rows.find(row => row.is_platform_admin === true);
  }
}

describe('PlatformOwnershipService', () => {
  let db: FakeDb;
  let service: PlatformOwnershipService;

  beforeEach(() => {
    db = new FakeDb([
      { id: 3, email: 'owner@x.test', is_platform_admin: true, roles: ['admin'] },
      { id: 7, email: 'admin@x.test', is_platform_admin: false, roles: ['admin'] },
      { id: 9, email: 'editor@x.test', is_platform_admin: false, roles: ['editor'] },
    ]);
    service = new PlatformOwnershipService(db);
  });

  it('reports the current owner and nobody else', async () => {
    expect(await service.currentOwnerId()).toBe(3);
    expect(await service.isOwner(3)).toBe(true);
    expect(await service.isOwner(7)).toBe(false);
  });

  it('hands the seat over and drops the previous owner to a plain admin', async () => {
    await service.transfer(3, 7);

    expect(await service.currentOwnerId()).toBe(7);
    expect(db.rows.find(r => r.id === 3)?.is_platform_admin).toBe(false);
    // The previous owner keeps administering — it loses the seat, not its account.
    expect(db.rows.find(r => r.id === 3)?.roles).toContain('admin');
  });

  it('leaves exactly one owner at every point — never two', async () => {
    await service.transfer(3, 7);
    expect(db.rows.filter(r => r.is_platform_admin === true)).toHaveLength(1);
  });

  it('guarantees the new owner can actually administer', async () => {
    await service.transfer(3, 9);
    expect(db.rows.find(r => r.id === 9)?.roles).toEqual(['editor', 'admin']);
    expect(db.junction).toEqual([{ userId: 9, roleSlug: 'admin' }]);
  });

  it('answers 403 to a caller who does not hold the seat', async () => {
    const error = await refusal(service.transfer(7, 9));
    expect(error).toBeInstanceOf(PlatformOwnershipError);
    expect(error.statusCode).toBe(403);
    expect(await service.currentOwnerId()).toBe(3);
  });

  it('answers 400 to a transfer to the current owner', async () => {
    expect((await refusal(service.transfer(3, 3))).statusCode).toBe(400);
  });

  it('answers 404 when the receiving account no longer exists', async () => {
    expect((await refusal(service.transfer(3, 404))).statusCode).toBe(404);
    expect(await service.currentOwnerId()).toBe(3);
  });

  it('answers 400 to an unidentifiable account rather than guessing', async () => {
    expect((await refusal(service.transfer(3, 'not-an-id'))).statusCode).toBe(400);
  });

  it('reports no owner on an install that never had one, without inventing one', async () => {
    const empty = new PlatformOwnershipService(new FakeDb([{ id: 1, is_platform_admin: false, roles: [] }]));
    expect(await empty.currentOwnerId()).toBeNull();
    expect(await empty.isOwner(1)).toBe(false);
  });
});

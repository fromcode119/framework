import { describe, it, expect, beforeEach } from 'vitest';
import { UserManagementService } from '@api/services/user-management-service';

/**
 * The owner seat is the one account `deleteUser` must refuse. Without this the platform can be left with
 * nobody able to administer it and no way to appoint anyone — the delete path had no checks of any kind.
 */
class FakeDb {
  deleted: any[] = [];

  constructor(private readonly rows: any[]) {}

  async find(_table: string, options: any) {
    return this.rows.filter(row => row.is_platform_admin === options?.where?.is_platform_admin);
  }

  async findOne(_table: string, where: any) {
    return this.rows.find(row => row.id === where.id) ?? null;
  }

  async update() { return undefined; }
  async delete(_table: string, where: any) { this.deleted.push(where); return true; }
}

describe('UserManagementService.deleteUser — platform owner', () => {
  let db: FakeDb;
  let service: UserManagementService;

  beforeEach(() => {
    db = new FakeDb([
      { id: 3, email: 'owner@x.test', is_platform_admin: true },
      { id: 7, email: 'admin@x.test', is_platform_admin: false },
    ]);
    service = new UserManagementService(db as any, {} as any, {} as any);
  });

  it('refuses to delete the platform owner, answering 409 and saying how to proceed', async () => {
    await expect(service.deleteUser(3)).rejects.toThrow(/owner cannot be deleted.*transfer ownership/i);
    await expect(service.deleteUser(3)).rejects.toMatchObject({ statusCode: 409 });
    expect(db.deleted).toEqual([]);
  });

  it('deletes an ordinary admin', async () => {
    await expect(service.deleteUser(7)).resolves.toBe(true);
    expect(db.deleted).toEqual([{ id: 7 }]);
  });
});

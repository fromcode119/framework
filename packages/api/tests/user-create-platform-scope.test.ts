import { describe, expect, it } from 'vitest';
import { Schema } from '@fromcode119/database';
import { RequestContextUtils, SystemConstants } from '@fromcode119/core';
import { UserManagementService } from '@api/services/user-management-service';

/**
 * Creating a user from PLATFORM scope wrote the new account's status meta on the plain connection.
 * With no site bound that is a tenant-less `_system_meta` row, which the row policy admits only under
 * the platform-admin marker — so the write was refused after the user row already existed: a 500 and
 * a half-made account. Inside a site the row is the site's, and needs no marker.
 */
class FakeDb {
  metaWrites: Array<{ key: string; asPlatform: boolean }> = [];
  private platform = false;

  async withPlatformAdmin<T>(fn: () => Promise<T>): Promise<T> {
    this.platform = true;
    try { return await fn(); } finally { this.platform = false; }
  }

  async insert(table: unknown, row: any) {
    if (table === Schema.users) return { id: 41 };
    if (table === SystemConstants.TABLE.META) this.metaWrites.push({ key: row.key, asPlatform: this.platform });
    return row;
  }

  async findOne() { return null; }
  async update() { return undefined; }
  async delete() { return true; }
}

const makeService = () => {
  const db = new FakeDb();
  const auth = { hashPassword: async () => 'hash' };
  return { db, service: new UserManagementService(db as any, auth as any, {} as any) };
};

describe('creating a user', () => {
  it('in platform scope, writes its account meta as the platform', async () => {
    const { db, service } = makeService();
    await service.saveUser(null, { email: 'new@x.test', firstName: 'N', lastName: 'U' });
    expect(db.metaWrites).toEqual([
      { key: 'user:41:account_status', asPlatform: true },
      { key: 'user:41:force_password_reset', asPlatform: true },
    ]);
  });

  it('inside a site, writes it as that site, without the platform marker', async () => {
    const { db, service } = makeService();
    await RequestContextUtils.storage.run({ tenantId: 'site-a' } as any, () =>
      service.saveUser(null, { email: 'new@x.test', firstName: 'N', lastName: 'U' }));
    expect(db.metaWrites.every((write) => write.asPlatform === false)).toBe(true);
  });
});

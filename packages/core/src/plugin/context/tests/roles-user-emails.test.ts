import { RolesContextProxy } from '@core/plugin/context/roles';
import { SystemConstants } from '@core/constants/system.constants';
import type { IPluginContextRoles } from '@core/interfaces/plugin-context-roles.interface';

/**
 * A user set shaped like the real failure: the admins that matter are reachable ONLY through the
 * `users_roles` junction, or sit past the window a naive JSON-column scan would look at.
 */
class UsersFixture {
  static readonly users = [
    { id: 1, email: 'Founder@Example.com', roles: ['admin'] },
    { id: 2, email: 'ops@example.com', roles: [] },
    { id: 3, email: 'customer@example.com', roles: ['customer'] },
    { id: 4, email: '', roles: ['admin'] },
  ];

  /** ops@ holds admin via the junction only — the JSON column does not say so. */
  static readonly usersRoles = [{ userId: 2, roleSlug: 'admin' }];

  static createManager(): any {
    return {
      db: {
        async find(table: string, options?: { where?: { roleSlug?: string } }) {
          if (table === SystemConstants.TABLE.USERS_ROLES) {
            const roleSlug = options?.where?.roleSlug;
            return UsersFixture.usersRoles.filter((row) => row.roleSlug === roleSlug);
          }
          if (table === SystemConstants.TABLE.USERS) return UsersFixture.users;
          return [];
        },
        async findOne(table: string, where: { id: number }) {
          if (table !== SystemConstants.TABLE.USERS) return null;
          return UsersFixture.users.find((user) => user.id === where.id) || null;
        },
      },
    };
  }
}

describe('context.roles.listUserEmailsWithRole', () => {
  it('is part of the declared plugin contract, so a plugin author can actually find it', () => {
    // Compile-time proof: the proxy must satisfy the interface, including this method.
    const roles: IPluginContextRoles = RolesContextProxy.createRolesProxy(UsersFixture.createManager()) as IPluginContextRoles;

    expect(roles.listUserEmailsWithRole).toBeInstanceOf(Function);
  });

  it('unions the junction table with the JSON column — the recipient that a JSON-only scan drops', async () => {
    const roles = RolesContextProxy.createRolesProxy(UsersFixture.createManager()) as IPluginContextRoles;

    const emails = await roles.listUserEmailsWithRole('admin');

    expect(emails).toContain('ops@example.com');
    expect(emails).toContain('founder@example.com');
  });

  it('lowercases, dedupes and drops users with no email', async () => {
    const roles = RolesContextProxy.createRolesProxy(UsersFixture.createManager()) as IPluginContextRoles;

    const emails = await roles.listUserEmailsWithRole('admin');

    // Junction hits first, then the JSON column; id 4 has no email and is dropped.
    expect(emails).toEqual(['ops@example.com', 'founder@example.com']);
  });

  it('returns nothing for a blank or unheld role rather than everyone', async () => {
    const roles = RolesContextProxy.createRolesProxy(UsersFixture.createManager()) as IPluginContextRoles;

    expect(await roles.listUserEmailsWithRole('')).toEqual([]);
    expect(await roles.listUserEmailsWithRole('nobody-holds-this')).toEqual([]);
  });

  it('lists the same user ids the email resolution is built on', async () => {
    const roles = RolesContextProxy.createRolesProxy(UsersFixture.createManager()) as IPluginContextRoles;

    expect([...(await roles.listUserIdsWithRole('admin'))].sort((a, b) => a - b)).toEqual([1, 2, 4]);
  });
});

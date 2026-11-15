import { describe, it, expect } from 'vitest';
import { PeopleManagementService } from '@api/services/people-management-service';

/**
 * The people directory is the one list a site has of everyone it knows, so a person who can sign in
 * has to be able to say WHAT they may do — not only that an account exists somewhere else.
 */
const people = [
  { id: 1, first_name: 'With account', email: 'a@example.com', user_id: 10 },
  { id: 2, first_name: 'Contact only', email: 'b@example.com', user_id: null },
  { id: 3, first_name: 'Account with no role', email: 'c@example.com', user_id: 11 },
];
const accounts = [{ id: 10, roles: ['admin', 'partner'] }, { id: 11, roles: [] }];

const service = (onFind?: (table: string, options: any) => void) => new PeopleManagementService({
  find: async (table: string, options: any) => {
    onFind?.(table, options);
    return table === 'users'
      ? accounts.filter((account) => (options?.where?.id?.in ?? []).includes(account.id))
      : people.slice(0, options?.limit ?? people.length);
  },
}, {} as any);

describe('PeopleManagementService.getPeople, the account a person has', () => {
  it('carries the roles of the account a person is linked to', async () => {
    const found = await service().getPeople({});
    expect(found.find((person: any) => person.id === 1)?.accountRoles).toEqual(['admin', 'partner']);
    expect(found.find((person: any) => person.id === 3)?.accountRoles).toEqual([]);
  });

  it('says nothing about an account for a person who has none', async () => {
    const found = await service().getPeople({});
    expect(found.find((person: any) => person.id === 2)).not.toHaveProperty('accountRoles');
  });

  it('reads the accounts once for the page, and only those that exist', async () => {
    const reads: Array<{ table: string; ids?: unknown }> = [];
    await service((table, options) => reads.push({ table, ids: options?.where?.id?.in })).getPeople({});
    const accountReads = reads.filter((read) => read.table === 'users');
    expect(accountReads).toHaveLength(1);
    expect(accountReads[0].ids).toEqual([10, 11]);
  });

  it('leaves the directory readable when the accounts cannot be read', async () => {
    const failing = new PeopleManagementService({
      find: async (table: string, options: any) => {
        if (table === 'users') throw new Error('no');
        return people.slice(0, options?.limit ?? people.length);
      },
    } as any, {} as any);
    const found = await failing.getPeople({});
    expect(found).toHaveLength(3);
    expect(found[0]).not.toHaveProperty('accountRoles');
  });
});

import { describe, expect, it, vi } from 'vitest';
import { McpPeopleTools } from '@api/controllers/mcp/tools/mcp-people-tools';
import { PeopleSelfService } from '@api/services/people-self-service';

const PERSON = { id: 31, displayName: 'Ana Buyer', firstName: 'Ana', lastName: 'Buyer', email: 'ana@example.com', phone: '0888', userId: 4, createdAt: 'T' };

const buildDeps = () => ({
  db: {},
  people: {
    getPeople: vi.fn(async () => [PERSON, { ...PERSON, id: 32, userId: null, email: null }]),
    getPerson: vi.fn(async (id: number) => (id === 31 ? { ...PERSON, account: { id: 4, email: 'ana@example.com', roles: ['editor'] } } : null)),
    savePerson: vi.fn(async (id: number, data: Record<string, unknown>) => ({ ...PERSON, id, ...data })),
  },
  mediaManager: {} as any,
  hooks: { call: vi.fn(async () => ({})) },
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}) as any;

const tool = (deps: any, name: string) => McpPeopleTools.all(deps).find((t) => t.tool === name)!;

describe('McpPeopleTools — the framework-owned people directory', () => {
  it('reads need users:view, the write needs users:manage, and every tool carries a schema', () => {
    const deps = buildDeps();
    expect(tool(deps, 'people.list')).toMatchObject({ readOnly: true, permission: 'users:view' });
    expect(tool(deps, 'people.get')).toMatchObject({ readOnly: true, permission: 'users:view' });
    expect(tool(deps, 'people.update')).toMatchObject({ readOnly: false, permission: 'users:manage' });
    for (const definition of McpPeopleTools.all(deps)) expect(definition.inputSchema, definition.tool).toBeTruthy();
  });

  it('list searches through the directory service and says who has a login account', async () => {
    const deps = buildDeps();
    const result: any = await tool(deps, 'people.list').handler({ search: 'ana', limit: 500 }, {});
    expect(deps.people.getPeople).toHaveBeenCalledWith({ q: 'ana', limit: 200 });
    expect(result.items).toEqual([
      expect.objectContaining({ id: 31, displayName: 'Ana Buyer', hasLoginAccount: true }),
      expect.objectContaining({ id: 32, hasLoginAccount: false }),
    ]);
  });

  it('get returns the person with the account facet, and refuses an unknown id', async () => {
    const deps = buildDeps();
    expect(await tool(deps, 'people.get').handler({ id: 31 }, {})).toMatchObject({ person: { id: 31, account: { roles: ['editor'] } } });
    await expect(tool(deps, 'people.get').handler({ id: 99 }, {})).rejects.toThrow(/No person 99/);
    await expect(tool(deps, 'people.get').handler({ id: 'x' } as any, {})).rejects.toThrow(/person id is required/);
  });

  it('update writes only profile fields through the admin\'s save, and only what was given', async () => {
    const deps = buildDeps();
    const result: any = await tool(deps, 'people.update').handler({ id: 31, phone: '0878663848', firstName: 'Anna' }, {});
    expect(deps.people.savePerson).toHaveBeenCalledWith(31, { phone: '0878663848', firstName: 'Anna' });
    expect(result).toMatchObject({ ok: true, updatedFields: ['phone', 'firstName'], person: { phone: '0878663848' } });
  });

  it('update refuses the account, its roles and its link by name — and writes nothing', async () => {
    const deps = buildDeps();
    const update = tool(deps, 'people.update');
    for (const forbidden of ['userId', 'roles', 'password', 'status', 'source']) {
      await expect(update.handler({ id: 31, [forbidden]: 'x' } as any, {}), forbidden).rejects.toThrow(new RegExp(`Not writable on a person: ${forbidden}`));
    }
    await expect(update.handler({ id: 31 }, {})).rejects.toThrow(/Nothing to update/);
    expect(deps.people.savePerson).not.toHaveBeenCalled();
  });

  it('the writable set is the directory\'s own allowlist plus the email — its schema offers nothing else', () => {
    const properties = Object.keys((tool(buildDeps(), 'people.update').inputSchema as any).properties);
    expect(properties.sort()).toEqual(['id', 'email', ...PeopleSelfService.WRITABLE].sort());
  });

  it('the service\'s own refusal reaches the caller (an account\'s email is changed on the account)', async () => {
    const deps = buildDeps();
    deps.people.savePerson.mockRejectedValue(new Error('This person has a login account; change the email on the account.'));
    await expect(tool(deps, 'people.update').handler({ id: 31, email: 'new@example.com' }, {})).rejects.toThrow(/change the email on the account/);
  });
});

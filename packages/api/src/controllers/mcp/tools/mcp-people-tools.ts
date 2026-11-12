import { McpSchema } from '@fromcode119/mcp';
import type { IMcpToolDefinition } from '@fromcode119/mcp';
import { CoercionUtils } from '@fromcode119/core';
import { IMcpToolDependencies } from '@api/controllers/mcp/interfaces/mcp-tool-dependencies.interface';
import { PeopleSelfService } from '@api/services/people-self-service';

/**
 * People tools over the FRAMEWORK-owned directory (Users → People) — every person the platform
 * knows: customers, contacts taken by phone, relatives entered by name, and the people behind login
 * accounts. All three delegate to `PeopleManagementService`, the service the admin screen uses, so
 * the search, the writable set and the email rules are the same on every surface.
 *
 * `people.update` changes a person's PROFILE and nothing else. The writable set is the directory's
 * own allowlist plus the email, exactly as the admin edit. What it deliberately cannot reach:
 * - the login account: its email, password and roles are changed on the account, in the admin. A
 *   person who HAS an account keeps that account's email (the service refuses the change);
 * - linking, unlinking or creating a login account, and deleting a person.
 * A key outside the set is refused by name rather than dropped.
 */
export class McpPeopleTools {
  private static readonly WRITABLE = [...PeopleSelfService.WRITABLE, 'email'];

  static all(deps: IMcpToolDependencies): IMcpToolDefinition[] {
    return [
      {
        tool: 'people.list',
        title: 'List people',
        description: 'List people in the directory, newest first. `search` matches the display name, first and last name, email and phone, across the whole directory.',
        readOnly: true,
        permission: 'users:view',
        inputSchema: McpSchema.object({
          search: McpSchema.string({ description: 'Optional text to find in a name, email or phone.' }),
          limit: McpSchema.number({ description: 'People to return, 1-200. Defaults to 50.' }),
        }),
        handler: async (input: any = {}) => {
          const limit = Math.min(200, Math.max(1, CoercionUtils.toNumber(input.limit) || 50));
          const people = await deps.people.getPeople({ q: CoercionUtils.toString(input.search), limit });
          const items = people.map((person: any) => McpPeopleTools.summary(person));
          return { items, count: items.length };
        },
      },
      {
        tool: 'people.get',
        title: 'Get a person',
        description: 'One person by id: their profile and, when they have a login account, that account\'s id, email, username and roles.',
        readOnly: true,
        permission: 'users:view',
        inputSchema: McpSchema.object({ id: McpSchema.number({ description: 'Person id (people.list).' }) }, ['id']),
        handler: async (input: any = {}) => {
          const person = await deps.people.getPerson(McpPeopleTools.id(input.id));
          if (!person) throw new Error(`No person ${McpPeopleTools.id(input.id)}.`);
          return { person };
        },
      },
      {
        tool: 'people.update',
        title: 'Update a person',
        description: `Change a person's profile: ${McpPeopleTools.WRITABLE.join(', ')}. Only what is given changes. The email of a person who has a login account is changed on the account, not here; two people may not share an email. Login accounts, roles and passwords are not reachable from this tool.`,
        readOnly: false,
        permission: 'users:manage',
        inputSchema: McpSchema.object({
          id: McpSchema.number({ description: 'Person id (people.list).' }),
          ...Object.fromEntries(McpPeopleTools.WRITABLE.map((field) => [field, McpSchema.string()])),
        }, ['id']),
        handler: async (input: any = {}) => {
          const id = McpPeopleTools.id(input.id);
          const { id: _id, ...values } = CoercionUtils.toObject(input);
          const unknown = Object.keys(values).filter((field) => !McpPeopleTools.WRITABLE.includes(field));
          if (unknown.length) throw new Error(`Not writable on a person: ${unknown.join(', ')}. Writable: ${McpPeopleTools.WRITABLE.join(', ')}.`);
          if (!Object.keys(values).length) throw new Error('Nothing to update — give at least one profile field.');
          const person = await deps.people.savePerson(id, values);
          return { ok: true, updatedFields: Object.keys(values), person };
        },
      },
    ];
  }

  private static id(raw: unknown): number {
    const id = CoercionUtils.toNumber(raw, 0);
    if (!Number.isInteger(id) || id < 1) throw new Error('A person id is required.');
    return id;
  }

  private static summary(person: any): Record<string, unknown> {
    return {
      id: person.id, displayName: person.displayName ?? null, firstName: person.firstName ?? null, lastName: person.lastName ?? null,
      email: person.email ?? null, phone: person.phone ?? null, hasLoginAccount: person.userId != null && person.userId !== '',
      createdAt: person.createdAt ?? null,
    };
  }
}

import { SystemConstants } from '@fromcode119/core';
import { PeopleSelfService } from './people-self-service';
import type { UserManagementService } from './user-management-service';

/**
 * Admin-facing management of the unified `people` model: list person records and promote a person
 * to a login account ("create user from person"). The data model already links the two via
 * `people.user_id`; this service is the missing admin surface — create the user, then link it.
 */
export class PeopleManagementService {
  constructor(private readonly db: any, private readonly users: UserManagementService) {}

  /**
   * Load a single person by id (camelCase admin shape) enriched with the linked login-account facet
   * — the user's id/email/username and EFFECTIVE roles (legacy column ∪ `_system_users_roles`
   * junction) — so the detail page can surface "who this person is across the platform" in one place.
   */
  async getPerson(personId: number): Promise<any | null> {
    const raw = await this.db.findOne(SystemConstants.TABLE.PEOPLE, { id: personId }).catch(() => null);
    if (!raw) return null;
    const person = PeopleSelfService.toCamel(raw);
    person.account = await this.resolveAccountFacet(person.userId);
    return person;
  }

  /** Linked login-account facet (null when the person has no user). Roles = column ∪ junction. */
  private async resolveAccountFacet(userId: any): Promise<any | null> {
    const uid = Number(userId);
    if (!uid) return null;
    const user = await this.db.findOne(SystemConstants.TABLE.USERS, { id: uid }).catch(() => null);
    if (!user) return null;
    const legacy = PeopleManagementService.parseRoles(user.roles);
    const rows = await this.db.find(SystemConstants.TABLE.USERS_ROLES, { where: { userId: uid } }).catch(() => []);
    const junction = (Array.isArray(rows) ? rows : [])
      .map((row: any) => String(row?.role_slug ?? '').trim())
      .filter(Boolean);
    return {
      id: uid,
      email: String(user.email ?? '').trim(),
      username: String(user.username ?? '').trim(),
      roles: Array.from(new Set([...legacy, ...junction])),
    };
  }

  private static parseRoles(raw: any): string[] {
    if (Array.isArray(raw)) return raw.map((r) => String(r || '').trim()).filter(Boolean);
    if (typeof raw === 'string' && raw.trim()) {
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.map((r) => String(r || '').trim()).filter(Boolean) : [];
      } catch {
        return [];
      }
    }
    return [];
  }

  /** List people (newest first), denormalized to the camelCase admin shape. */
  async getPeople(): Promise<any[]> {
    const rows = await this.db
      .find(SystemConstants.TABLE.PEOPLE, { orderBy: { createdAt: 'desc' }, limit: 1000 })
      .catch(() => []);
    return (Array.isArray(rows) ? rows : []).map((row: any) => PeopleSelfService.toCamel(row));
  }

  /**
   * Update an existing person's editable profile fields (admin edit). Uses the same writable
   * allowlist as self-service, so admin edits can never touch `userId`/`source`/`status` here.
   * Returns the refreshed camelCase record.
   */
  async savePerson(personId: number, data: Record<string, any>): Promise<any> {
    const raw = await this.db.findOne(SystemConstants.TABLE.PEOPLE, { id: personId });
    if (!raw) throw new Error('Person not found');
    const record = PeopleSelfService.toPersonRecord(data || {});
    if (Object.keys(record).length > 0) {
      await this.db.update(SystemConstants.TABLE.PEOPLE, { id: personId }, record);
    }
    return PeopleSelfService.toCamel(await this.db.findOne(SystemConstants.TABLE.PEOPLE, { id: personId }));
  }

  /**
   * Promote a person to a login account: create the user (random password if none supplied) and
   * link it back onto the person row. Refuses if the person is missing, has no email, or is already
   * linked to a user.
   */
  async createUserFromPerson(personId: number, data: Record<string, any>): Promise<{ userId: number }> {
    const raw = await this.db.findOne(SystemConstants.TABLE.PEOPLE, { id: personId });
    if (!raw) throw new Error('Person not found');
    const person = PeopleSelfService.toCamel(raw);
    if (person.userId) throw new Error('This person already has a login account');

    const email = String(data?.email || person.email || '').trim().toLowerCase();
    if (!email) throw new Error('An email is required to create a login account');

    const userId = await this.users.saveUser(null, {
      email,
      firstName: data?.firstName ?? person.firstName,
      lastName: data?.lastName ?? person.lastName,
      password: data?.password || undefined,
      roles: Array.isArray(data?.roles) ? data.roles : [],
    });
    if (userId == null) throw new Error('Failed to create the login account');

    // Link the new account back onto the person (camelCase write; the db denormalizes to user_id).
    await this.db.update(SystemConstants.TABLE.PEOPLE, { id: personId }, { userId });
    return { userId };
  }
}

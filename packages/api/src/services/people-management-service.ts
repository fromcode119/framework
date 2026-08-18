import { SystemConstants } from '@fromcode119/core';
import { PeopleSelfService } from '@api/services/people-self-service';
import type { UserManagementService } from '@api/services/user-management-service';

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
  async getPeople(options?: { q?: string; limit?: number }): Promise<any[]> {
    const limit = Math.max(1, Math.min(1000, Number(options?.limit) || 1000));
    const rows = await this.db
      .find(SystemConstants.TABLE.PEOPLE, { orderBy: { createdAt: 'desc' }, limit })
      .catch(() => []);
    const people = (Array.isArray(rows) ? rows : []).map((row: any) => PeopleSelfService.toCamel(row));

    const query = String(options?.q || '').trim().toLowerCase();
    if (!query) return people;

    // Filtered here rather than in SQL because the searchable value is a COMPOSITE of several nullable
    // columns (display name, first/last, email); a LIKE over one of them would miss the others.
    return people.filter((person: any) => PeopleManagementService.haystack(person).includes(query));
  }

  private static haystack(person: any): string {
    return [person?.displayName, person?.firstName, person?.lastName, person?.email]
      .map((value) => String(value || '').toLowerCase())
      .join(' ');
  }

  /**
   * Recipient suggestions for a share: people who actually have an email address.
   *
   * `people.email` is NULLABLE and NOT UNIQUE — the table holds contacts backfilled from orders and
   * relatives entered by name alone — so blanks are dropped and duplicates collapsed. Without that the
   * picker offers empty entries and the same address several times.
   */
  async suggestRecipients(options?: { q?: string; limit?: number }): Promise<Array<{ value: string; label: string }>> {
    const people = await this.getPeople({ q: options?.q });
    const limit = Math.max(1, Math.min(50, Number(options?.limit) || 20));
    const byEmail = new Map<string, { value: string; label: string }>();

    for (const person of people) {
      const email = String(person?.email || '').trim().toLowerCase();
      if (!email.includes('@') || byEmail.has(email)) continue;

      const name = String(person?.displayName || [person?.firstName, person?.lastName].filter(Boolean).join(' ') || '').trim();
      byEmail.set(email, { value: email, label: name ? `${name} <${email}>` : email });
      if (byEmail.size >= limit) break;
    }

    return [...byEmail.values()];
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

  /** Permanently delete a person record. The linked login user (if any) is left intact. */
  async deletePerson(personId: number): Promise<void> {
    const raw = await this.db.findOne(SystemConstants.TABLE.PEOPLE, { id: personId });
    if (!raw) throw new Error('Person not found');
    await this.db.delete(SystemConstants.TABLE.PEOPLE, { id: personId });
  }

  /**
   * Reassign (or clear) the login account linked to a person. Pass a userId to link an existing
   * user; pass null/0 to unlink. Validates the target user exists and is not already linked to a
   * different person, so the people↔users link stays one-to-one.
   */
  async linkUser(personId: number, userId: number | null): Promise<any> {
    const raw = await this.db.findOne(SystemConstants.TABLE.PEOPLE, { id: personId });
    if (!raw) throw new Error('Person not found');
    const uid = Number(userId) || 0;
    if (uid) {
      const user = await this.db.findOne(SystemConstants.TABLE.USERS, { id: uid }).catch(() => null);
      if (!user) throw new Error('That user account does not exist');
      const other = await this.db.findOne(SystemConstants.TABLE.PEOPLE, { userId: uid }).catch(() => null);
      if (other && Number(other.id) !== Number(personId)) {
        throw new Error('That user is already linked to another person');
      }
    }
    await this.db.update(SystemConstants.TABLE.PEOPLE, { id: personId }, { userId: uid || null });
    return this.getPerson(personId);
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

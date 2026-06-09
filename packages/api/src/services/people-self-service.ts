import { SystemConstants } from '@fromcode119/core';

/**
 * Framework self-service over the unified `people` model — the logged-in user's own person row
 * (firstName/lastName/birthDate/phone, the identity-consolidation record). Replaces the former
 * `account` plugin `/me`. Uses the denormalizing db context (camelCase), so no snake_case mapping.
 */
export class PeopleSelfService {
  private static readonly WRITABLE = [
    'firstName', 'lastName', 'displayName', 'middleName', 'preferredName',
    'phone', 'birthDate', 'gender', 'pronouns', 'preferredLocale', 'timezone', 'country', 'bio', 'avatarUrl',
  ];

  constructor(private readonly db: any) {}

  /** Denormalize a raw people row (snake_case columns) to the camelCase API shape. */
  static toCamel(row: any): any {
    if (!row || typeof row !== 'object') return row;
    const out: Record<string, any> = {};
    for (const [key, value] of Object.entries(row)) {
      out[key.replace(/_([a-z])/g, (_m, c: string) => c.toUpperCase())] = value;
    }
    return out;
  }

  static toPersonRecord(input: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const field of PeopleSelfService.WRITABLE) {
      if (input[field] === undefined) continue;
      out[field] = String(input[field] ?? '').trim();
    }
    return out;
  }

  /** Resolve (or create + link) the authenticated user's own person row. */
  async resolveSelf(user: { id?: any; email?: string; firstName?: string; lastName?: string }): Promise<any> {
    const userId = user?.id ?? null;
    const email = String(user?.email || '').trim().toLowerCase();

    let person = userId != null ? PeopleSelfService.toCamel(await this.db.findOne(SystemConstants.TABLE.PEOPLE, { userId })) : null;
    if (!person && email) person = PeopleSelfService.toCamel(await this.db.findOne(SystemConstants.TABLE.PEOPLE, { email }));

    if (!person) {
      await this.db.insert(SystemConstants.TABLE.PEOPLE, {
        userId,
        email,
        firstName: String(user?.firstName || '').trim(),
        lastName: String(user?.lastName || '').trim(),
        source: 'self',
        status: 'active',
      });
      person = PeopleSelfService.toCamel(userId != null
        ? await this.db.findOne(SystemConstants.TABLE.PEOPLE, { userId })
        : await this.db.findOne(SystemConstants.TABLE.PEOPLE, { email }));
    } else if (person.userId == null && userId != null) {
      await this.db.update(SystemConstants.TABLE.PEOPLE, { id: person.id }, { userId });
      person.userId = userId;
    }

    return person;
  }

  async updateSelf(person: any, input: Record<string, unknown>): Promise<any> {
    const record = PeopleSelfService.toPersonRecord(input);
    if (Object.keys(record).length > 0) {
      await this.db.update(SystemConstants.TABLE.PEOPLE, { id: person.id }, record);
    }
    return PeopleSelfService.toCamel(await this.db.findOne(SystemConstants.TABLE.PEOPLE, { id: person.id }));
  }
}

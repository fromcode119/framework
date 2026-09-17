import { NamingStrategy } from '@fromcode119/database';

/**
 * Between a people ROW and what a plugin sees.
 *
 * Every field is mapped explicitly and defaults to null rather than being spread through, which is
 * the point: a plugin gets the person shape the framework promises, not whatever columns happen to
 * exist today. A column added to the table does not silently appear in plugin context, and one
 * removed does not silently vanish from it.
 *
 * Email is FOLDED for comparison — matching a person by address cannot depend on how somebody typed
 * it — while the stored value keeps its original form.
 *
 * Split out of `PeopleContext`, whose `createPeopleProxy` is a single 259-line factory.
 */
export class PeopleRowMapper {
  static foldEmail(email?: string): string {
    return String(email ?? '').trim().toLowerCase();
  }

  static normalizeWrite(input: Record<string, any>): Record<string, any> {
    const data: Record<string, any> = { ...input };
    if (typeof data.email === 'string') data.email = PeopleRowMapper.foldEmail(data.email);
    if (typeof data.phone === 'string') data.phone = data.phone.trim();
    // A blank userId must never reach the people.user_id column — it is an INTEGER FK to users.id,
    // so '' or whitespace would throw "FOREIGN KEY constraint failed". Omit it (leave existing/NULL).
    if (data.userId == null || String(data.userId).trim() === '') delete data.userId;
    return data;
  }

  // Reads from the RAW manager.db return snake_case columns; map to the camelCase
  // shape plugins expect. The proxy reads via the raw DB manager (snake_case columns), so we
  // denormalize the row to camelCase ONCE and then map a single canonical (camelCase) name per
  // field — no dual camel/snake lookups. `denormalizeRecord` is idempotent on already-camelCase
  // keys, so this also works against the camelCase rows used by the unit-test mocks.
  static toPerson(row: any): any {
    if (!row) return null;
    const r = NamingStrategy.denormalizeRecord(row);
    return {
      id: r.id,
      userId: r.userId ?? null,
      status: r.status ?? null,
      source: r.source ?? null,
      firstName: r.firstName ?? null,
      lastName: r.lastName ?? null,
      middleName: r.middleName ?? null,
      displayName: r.displayName ?? null,
      preferredName: r.preferredName ?? null,
      email: r.email ?? null,
      phone: r.phone ?? null,
      birthDate: r.birthDate ?? null,
      gender: r.gender ?? null,
      pronouns: r.pronouns ?? null,
      preferredLocale: r.preferredLocale ?? null,
      timezone: r.timezone ?? null,
      country: r.country ?? null,
      avatarUrl: r.avatarUrl ?? null,
      bio: r.bio ?? null,
      metadata: r.metadata ?? null,
      createdAt: r.createdAt ?? null,
      updatedAt: r.updatedAt ?? null
    };
  }

  static toRelationship(row: any): any {
    if (!row) return null;
    const r = NamingStrategy.denormalizeRecord(row);
    return {
      id: r.id,
      fromPersonId: r.fromPersonId ?? null,
      toPersonId: r.toPersonId ?? null,
      type: r.type ?? null,
      metadata: r.metadata ?? null
    };
  }
}

import { NamingStrategy } from '@fromcode119/database';
import { LoadedPlugin } from '../../types';
import type { PluginManagerInterface } from './utils.interfaces';
import { SystemConstants } from '../../constants';
import { PersonCatalogService } from '../services/person-catalog-service';
import { PeopleAddressService } from '../services/people-address-service';
import type { PeopleAddressRef } from '../services/people-address-service.interfaces';

export class PeopleContextProxy {

  static createPeopleProxy(
    _plugin: LoadedPlugin,
    manager: PluginManagerInterface
  ) {
    const db = manager.db as any;
    const catalogs = new PersonCatalogService(db);
    const addresses = new PeopleAddressService(db);

    async function match(input: { userId?: any; email?: string; phone?: string }) {
      if (input?.userId != null && input.userId !== '') {
        const byUser = await db.findOne(SystemConstants.TABLE.PEOPLE, { userId: input.userId });
        if (byUser) return PeopleContextProxy.toPerson(byUser);
      }
      const email = PeopleContextProxy.foldEmail(input?.email);
      if (email) {
        const byEmail = await db.findOne(SystemConstants.TABLE.PEOPLE, { email });
        if (byEmail) return PeopleContextProxy.toPerson(byEmail);
      }
      const phone = String(input?.phone ?? '').trim();
      if (phone) {
        const byPhone = await db.findOne(SystemConstants.TABLE.PEOPLE, { phone });
        if (byPhone) return PeopleContextProxy.toPerson(byPhone);
      }
      return null;
    }

    return {
      match,

      async getById(id: any) {
        if (id == null || id === '') return null;
        return PeopleContextProxy.toPerson(await db.findOne(SystemConstants.TABLE.PEOPLE, { id }));
      },

      async getByUserId(userId: any) {
        if (userId == null || userId === '') return null;
        return PeopleContextProxy.toPerson(await db.findOne(SystemConstants.TABLE.PEOPLE, { userId }));
      },

      async getByEmail(email: string) {
        const folded = PeopleContextProxy.foldEmail(email);
        if (!folded) return null;
        return PeopleContextProxy.toPerson(await db.findOne(SystemConstants.TABLE.PEOPLE, { email: folded }));
      },

      async upsert(input: Record<string, any>) {
        const data = PeopleContextProxy.normalizeWrite(input);
        const existing = await match({ userId: input?.userId, email: input?.email, phone: input?.phone });
        if (existing) {
          // `displayName` is USER-OWNED: it is set/cleared only via the admin person editor (which writes
          // through db.update, not this upsert). Plugin people-backfills funnel here every boot with a
          // plugin-derived name; letting them overwrite displayName clobbered an admin-set name and made a
          // deliberately CLEARED displayName reappear on the next backfill. Seed it on first insert, but
          // never mutate it for an existing person — the person row owns it from then on.
          const update = { ...data };
          delete (update as any).displayName;
          if (Object.keys(update).length > 0) {
            await db.update(SystemConstants.TABLE.PEOPLE, { id: existing.id }, update);
          }
          return { ...existing, ...update };
        }
        return PeopleContextProxy.toPerson(await db.insert(SystemConstants.TABLE.PEOPLE, data));
      },

      async linkAccount(personId: any, userId: any) {
        if (personId == null || userId == null) return null;
        return db.update(SystemConstants.TABLE.PEOPLE, { id: personId }, { userId });
      },

      async addRelationship(fromPersonId: any, toPersonId: any, type: string, metadata?: Record<string, any>) {
        return db.insert(SystemConstants.TABLE.PERSON_RELATIONSHIPS, {
          fromPersonId,
          toPersonId,
          type: String(type ?? '').trim(),
          metadata: metadata ?? {}
        });
      },

      async listRelated(fromPersonId: any, type?: string) {
        const where: Record<string, any> = { fromPersonId };
        if (type) where.type = String(type).trim();
        const rows = await db.find(SystemConstants.TABLE.PERSON_RELATIONSHIPS, { where });
        return (Array.isArray(rows) ? rows : []).map(PeopleContextProxy.toRelationship);
      },

      catalogs: {
        register: (kind: string, entry: { key: string; label: string; pluginSlug?: string }) => catalogs.register(kind, entry),
        list: (kind: string) => catalogs.list(kind)
      },

      // Reusable address book on the shared `people_addresses` table. Plugins delegate their account
      // address book here instead of owning a parallel store. `ref` resolves the owning person from
      // { personId } | { userId } | { email }; upsert creates a minimal person when none exists yet.
      addresses: {
        list: (ref: PeopleAddressRef) => addresses.list(ref),
        upsert: (ref: PeopleAddressRef, addr: Record<string, any>) => addresses.upsert(ref, addr),
        delete: (addressId: any) => addresses.delete(addressId),
        setDefault: (ref: PeopleAddressRef, addressId: any) => addresses.setDefault(ref, addressId)
      }
    };
  }

  private static foldEmail(email?: string): string {
    return String(email ?? '').trim().toLowerCase();
  }

  private static normalizeWrite(input: Record<string, any>): Record<string, any> {
    const data: Record<string, any> = { ...input };
    if (typeof data.email === 'string') data.email = PeopleContextProxy.foldEmail(data.email);
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
  private static toPerson(row: any): any {
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

  private static toRelationship(row: any): any {
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

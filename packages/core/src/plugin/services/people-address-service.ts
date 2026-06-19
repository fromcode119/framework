import { SystemConstants } from '../../constants';
import { PeopleAddressRepository } from './people-address-repository';
import type { PeopleAddressRef } from './people-address-service.interfaces';

interface PeopleResolverDb {
  find(table: string, opts?: any): Promise<any[]>;
  findOne(table: string, where: any): Promise<any | null>;
  insert(table: string, data: any): Promise<any>;
  update(table: string, where: any, data: any): Promise<any>;
  delete(table: string, where: any): Promise<any>;
}

/**
 * Framework-owned address book service backing `context.people.addresses`. Resolves the owning
 * `people` row from a flexible reference ({ personId } | { userId } | { email }) and reads/writes the
 * shared `people_addresses` table via {@link PeopleAddressRepository}. Enforces a single default per
 * person.
 *
 * Identity requirement: an address must belong to a `people` row. When a ref carries a userId/email
 * but no matching person yet exists, `upsert` will create a minimal person (so account holders and
 * email-only contacts both get an address book). Refs with no resolvable identity (e.g. a fully
 * anonymous guest with neither userId nor email) are rejected — guest checkout address snapshots live
 * on the order, not in the shared address book.
 */
export class PeopleAddressService {
  private readonly repo: PeopleAddressRepository;

  constructor(private readonly db: PeopleResolverDb) {
    this.repo = new PeopleAddressRepository(db as any);
  }

  /** List the addresses for the person identified by `ref`. Returns [] when no person resolves. */
  async list(ref: PeopleAddressRef): Promise<any[]> {
    const personId = await this.resolvePersonId(ref, false);
    if (personId == null) return [];
    return this.repo.listByPerson(personId);
  }

  /**
   * Create or update an address for the person identified by `ref`. When `addr.id` is present and the
   * row belongs to the resolved person, it is updated; otherwise a new row is inserted. Passing
   * `addr.isDefault === true` (or creating the person's first address) makes it the sole default.
   * Creates a minimal person from the ref when none exists yet.
   */
  async upsert(ref: PeopleAddressRef, addr: Record<string, any>): Promise<any> {
    const personId = await this.resolvePersonId(ref, true);
    if (personId == null) throw new Error('people_address: cannot resolve or create a person for this address');

    const fields = PeopleAddressService.sanitize(addr);
    const existing = await this.repo.listByPerson(personId);
    const targetId = PeopleAddressService.toId(addr?.id);
    const owned = targetId != null ? existing.find((r) => Number(r.id) === targetId) : null;

    const makeDefault = PeopleAddressService.toBool(addr?.isDefault) || (existing.length === 0 && !owned);
    const now = new Date().toISOString();

    if (owned) {
      if (makeDefault) await this.repo.clearDefaults(personId, owned.id);
      return this.repo.update(Number(owned.id), {
        ...fields,
        ...(makeDefault ? { isDefault: true } : {}),
        updatedAt: now
      });
    }

    if (makeDefault) await this.repo.clearDefaults(personId);
    return this.repo.insert({
      ...fields,
      personId,
      isDefault: makeDefault,
      createdAt: now,
      updatedAt: now
    });
  }

  /** Delete an address by id. When the removed row was the default, promotes another to default. */
  async delete(addressId: any): Promise<{ deleted: boolean }> {
    const id = PeopleAddressService.toId(addressId);
    if (id == null) return { deleted: false };
    const row = await this.repo.findById(id);
    if (!row) return { deleted: false };
    await this.repo.delete(id);
    if (row.isDefault && row.personId != null) {
      const remaining = await this.repo.listByPerson(Number(row.personId));
      if (remaining.length > 0) {
        await this.repo.update(Number(remaining[0].id), { isDefault: true, updatedAt: new Date().toISOString() });
      }
    }
    return { deleted: true };
  }

  /** Mark one address as the sole default for the person identified by `ref`. */
  async setDefault(ref: PeopleAddressRef, addressId: any): Promise<any> {
    const personId = await this.resolvePersonId(ref, false);
    const id = PeopleAddressService.toId(addressId);
    if (personId == null || id == null) return null;
    const row = await this.repo.findById(id);
    if (!row || Number(row.personId) !== Number(personId)) return null;
    await this.repo.clearDefaults(personId, id);
    return this.repo.update(id, { isDefault: true, updatedAt: new Date().toISOString() });
  }

  /**
   * Resolve the `people.id` for a reference. When `create` is true and the ref carries a usable
   * identity (userId or email) but no person exists, a minimal person row is created. Returns null
   * when no person can be resolved (and, with create=false, never inserts).
   */
  private async resolvePersonId(ref: PeopleAddressRef, create: boolean): Promise<number | null> {
    const direct = PeopleAddressService.toId(ref?.personId);
    if (direct != null) return direct;

    const userId = ref?.userId;
    if (userId != null && String(userId).trim() !== '') {
      const byUser = await this.db.findOne(SystemConstants.TABLE.PEOPLE, { userId });
      if (byUser?.id != null) return Number(byUser.id);
    }
    const email = PeopleAddressService.foldEmail(ref?.email);
    if (email) {
      const byEmail = await this.db.findOne(SystemConstants.TABLE.PEOPLE, { email });
      if (byEmail?.id != null) return Number(byEmail.id);
    }

    if (!create) return null;
    // No person yet — create a minimal one from whatever identity the ref carries. A blank userId is
    // never written (it is an INTEGER FK to users.id); email-only contacts are valid people.
    if (!userId && !email) return null;
    const data: Record<string, any> = { source: 'contact' };
    if (userId != null && String(userId).trim() !== '') data.userId = userId;
    if (email) data.email = email;
    const created = await this.db.insert(SystemConstants.TABLE.PEOPLE, data);
    return created?.id != null ? Number(created.id) : null;
  }

  private static sanitize(input: Record<string, any>): Record<string, any> {
    const s = (v: any): string => String(v ?? '').trim();
    const fields: Record<string, any> = {
      label: s(input?.label),
      fullName: s(input?.fullName),
      addressLine1: s(input?.addressLine1),
      addressLine2: s(input?.addressLine2),
      city: s(input?.city),
      postalCode: s(input?.postalCode),
      country: s(input?.country).toUpperCase(),
      phone: s(input?.phone)
    };
    // metadata is an opt-in extension blob (e.g. Econt delivery binding) — only set it when provided
    // so an update without metadata never clobbers an existing value.
    if (input?.metadata != null && typeof input.metadata === 'object') {
      fields.metadata = input.metadata;
    }
    return fields;
  }

  private static foldEmail(email?: string): string {
    return String(email ?? '').trim().toLowerCase();
  }

  private static toId(value: any): number | null {
    if (value == null || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  private static toBool(value: any): boolean {
    return value === true || value === 1 || value === '1' || value === 'true';
  }
}

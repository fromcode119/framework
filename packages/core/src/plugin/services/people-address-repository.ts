import { NamingStrategy } from '@fromcode119/database';
import { SystemConstants } from '../../constants';

interface AddressDb {
  find(table: string, opts?: any): Promise<any[]>;
  findOne(table: string, where: any): Promise<any | null>;
  insert(table: string, data: any): Promise<any>;
  update(table: string, where: any, data: any): Promise<any>;
  delete(table: string, where: any): Promise<any>;
}

/**
 * Raw data access for the framework-owned `people_addresses` table — the reusable address book every
 * plugin shares (ecommerce delegates its account address book to it). This is core internal code, so
 * it talks to the raw DB manager: writes use camelCase keys (the dialect maps them to snake_case
 * columns) and reads come back as snake_case rows, which are denormalized once to camelCase via
 * {@link NamingStrategy.denormalizeRecord} so callers always see a single canonical (camelCase) shape.
 *
 * The `metadata` JSON column is an additive extension (migration 010) used to stash plugin-specific
 * delivery binding (Econt city/office, delivery provider) without polluting the shared columns.
 */
export class PeopleAddressRepository {
  constructor(private readonly db: AddressDb) {}

  async listByPerson(personId: number): Promise<any[]> {
    const rows = await this.db.find(SystemConstants.TABLE.PEOPLE_ADDRESSES, {
      where: { personId },
      orderBy: { isDefault: 'desc', createdAt: 'desc' },
      limit: 200
    });
    return (Array.isArray(rows) ? rows : []).map((r) => PeopleAddressRepository.toAddress(r));
  }

  async findById(addressId: number): Promise<any | null> {
    const row = await this.db.findOne(SystemConstants.TABLE.PEOPLE_ADDRESSES, { id: addressId });
    return PeopleAddressRepository.toAddress(row);
  }

  async insert(data: Record<string, any>): Promise<any> {
    const row = await this.db.insert(SystemConstants.TABLE.PEOPLE_ADDRESSES, data);
    return PeopleAddressRepository.toAddress(row);
  }

  async update(addressId: number, data: Record<string, any>): Promise<any> {
    await this.db.update(SystemConstants.TABLE.PEOPLE_ADDRESSES, { id: addressId }, data);
    return this.findById(addressId);
  }

  async delete(addressId: number): Promise<void> {
    await this.db.delete(SystemConstants.TABLE.PEOPLE_ADDRESSES, { id: addressId });
  }

  /** Clear the default flag on every address of a person except (optionally) one to keep. */
  async clearDefaults(personId: number, exceptId?: number): Promise<void> {
    const rows = await this.listByPerson(personId);
    for (const row of rows) {
      if (row?.isDefault && (exceptId == null || Number(row.id) !== Number(exceptId))) {
        await this.db.update(SystemConstants.TABLE.PEOPLE_ADDRESSES, { id: Number(row.id) }, { isDefault: false });
      }
    }
  }

  /**
   * Map a raw row to the canonical camelCase shape, parsing the JSON `metadata` column (the raw
   * manager returns it as a string on SQLite / object on Postgres). A `null`/absent row → `null`.
   */
  private static toAddress(row: any): any {
    if (!row) return null;
    const r = NamingStrategy.denormalizeRecord(row);
    return {
      id: r.id,
      personId: r.personId ?? null,
      label: r.label ?? null,
      fullName: r.fullName ?? null,
      addressLine1: r.addressLine1 ?? null,
      addressLine2: r.addressLine2 ?? null,
      city: r.city ?? null,
      postalCode: r.postalCode ?? null,
      country: r.country ?? null,
      phone: r.phone ?? null,
      isDefault: PeopleAddressRepository.toBool(r.isDefault),
      metadata: PeopleAddressRepository.parseJson(r.metadata),
      createdAt: r.createdAt ?? null,
      updatedAt: r.updatedAt ?? null
    };
  }

  private static toBool(value: any): boolean {
    return value === true || value === 1 || value === '1' || value === 'true';
  }

  private static parseJson(value: any): Record<string, any> {
    if (value == null || value === '') return {};
    if (typeof value === 'object') return value as Record<string, any>;
    try {
      const parsed = JSON.parse(String(value));
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
}

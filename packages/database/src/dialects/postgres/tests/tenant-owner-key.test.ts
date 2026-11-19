import { describe, expect, it } from 'vitest';
import { PostgresTenantOwnerKey } from '@database/dialects/postgres/tenant/tenant-owner-key';

/**
 * A fresh single-site installation could not upload a file or keep the signed-in user's person record:
 * its empty tables had taken the (tenant_id, id) key, and with no tenant there is no site to put in it.
 */
describe('PostgresTenantOwnerKey.release — a deployment with no tenants', () => {
  const database = (answers: { key?: Array<Record<string, unknown>>; required?: boolean; references?: Array<Record<string, unknown>>; failOn?: string }) => {
    const issued: string[] = [];
    const run = async (text: string) => {
      const statement = text.replace(/\s+/g, ' ').trim();
      issued.push(statement);
      if (answers.failOn && statement.includes(answers.failOn)) throw new Error('duplicate key');
      if (statement.includes("c.contype = 'p'")) return answers.key ?? [];
      if (statement.includes('a.attnotnull')) return [{ required: answers.required ?? false }];
      if (statement.includes("c.contype = 'f'")) return answers.references ?? [];
      return [];
    };
    return { issued, run, changes: () => issued.filter((statement) => statement.startsWith('ALTER')) };
  };
  const wideKey = [{ name: 'people_pkey', column_name: 'tenant_id' }, { name: 'people_pkey', column_name: 'id' }];
  const addresses = { name: 'people_addresses_person_id_fkey', child: 'people_addresses', definition: 'FOREIGN KEY (tenant_id, person_id) REFERENCES people(tenant_id, id) ON DELETE CASCADE', del: 'c', upd: 'a', child_columns: 'tenant_id,person_id', parent_columns: 'tenant_id,id' };

  it('keys the table on its own id again and stops requiring a site, in one statement', async () => {
    const db = database({ key: wideKey });

    expect(await new PostgresTenantOwnerKey(db.run as never).release('people')).toBe(true);
    expect(db.changes()).toEqual(['ALTER TABLE "people" DROP CONSTRAINT "people_pkey", ADD PRIMARY KEY ("id"), ALTER COLUMN "tenant_id" DROP NOT NULL']);
  });

  it('rebuilds a reference on the narrow key and keeps what it does on delete', async () => {
    const db = database({ key: wideKey, references: [addresses] });

    await new PostgresTenantOwnerKey(db.run as never).release('people');

    expect(db.changes()).toEqual([
      'ALTER TABLE "people_addresses" DROP CONSTRAINT "people_addresses_person_id_fkey"',
      'ALTER TABLE "people" DROP CONSTRAINT "people_pkey", ADD PRIMARY KEY ("id"), ALTER COLUMN "tenant_id" DROP NOT NULL',
      'ALTER TABLE "people_addresses" ADD CONSTRAINT "people_addresses_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "people" ("id") ON DELETE CASCADE',
    ]);
  });

  it('puts a reference back exactly as it was when the key cannot change', async () => {
    const db = database({ key: wideKey, references: [addresses], failOn: 'ADD PRIMARY KEY' });

    await expect(new PostgresTenantOwnerKey(db.run as never).release('people')).rejects.toThrow('duplicate key');
    expect(db.changes().at(-1)).toBe(`ALTER TABLE "people_addresses" ADD CONSTRAINT "people_addresses_person_id_fkey" ${addresses.definition}`);
  });

  it('only stops requiring a site on a table that never took the wide key', async () => {
    const db = database({ key: [{ name: 'pages_pkey', column_name: 'id' }], required: true });

    expect(await new PostgresTenantOwnerKey(db.run as never).release('pages')).toBe(true);
    expect(db.changes()).toEqual(['ALTER TABLE "pages" ALTER COLUMN "tenant_id" DROP NOT NULL']);
  });

  it('leaves alone a table that already allows a row with no site', async () => {
    const db = database({ key: [{ name: 'pages_pkey', column_name: 'id' }], required: false });

    expect(await new PostgresTenantOwnerKey(db.run as never).release('pages')).toBe(false);
    expect(db.changes()).toEqual([]);
  });

  it('refuses a name that is not a plain identifier', async () => {
    await expect(new PostgresTenantOwnerKey(database({}).run as never).release('people"; DROP TABLE x')).rejects.toThrow('not a plain SQL identifier');
  });
});

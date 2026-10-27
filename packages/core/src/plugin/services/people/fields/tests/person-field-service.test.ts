import { describe, expect, it } from 'vitest';
import type { ICatalogDb } from '@core/plugin/services/interfaces/catalog-db.interface';
import { PersonFieldService } from '@core/plugin/services/people/fields/person-field-service';
import { PersonFieldValueError } from '@core/plugin/services/people/fields/person-field-value';

class MemoryDb implements ICatalogDb {
  private readonly tables = new Map<string, any[]>();

  private rows(table: string): any[] {
    if (!this.tables.has(table)) this.tables.set(table, []);
    return this.tables.get(table)!;
  }

  private static matches(row: any, where: any): boolean {
    return Object.entries(where ?? {}).every(([key, value]) => row[key] === value);
  }

  async find(table: string, opts?: any): Promise<any[]> {
    return this.rows(table).filter((row) => MemoryDb.matches(row, opts?.where));
  }

  async findOne(table: string, where: any): Promise<any | null> {
    return this.rows(table).find((row) => MemoryDb.matches(row, where)) ?? null;
  }

  async insert(table: string, data: any): Promise<any> {
    this.rows(table).push({ ...data });
    return data;
  }

  async update(table: string, where: any, data: any): Promise<any> {
    for (const row of this.rows(table)) if (MemoryDb.matches(row, where)) Object.assign(row, data);
    return data;
  }

  async delete(table: string, where: any): Promise<any> {
    this.tables.set(table, this.rows(table).filter((row) => !MemoryDb.matches(row, where)));
  }
}

describe('PersonFieldService', () => {
  const service = () => new PersonFieldService(new MemoryDb());

  it('stores a value checked against the declared field and reads it back', async () => {
    const fields = service();
    await fields.save({ key: 'favouriteColour', type: 'choice', label: { en: 'Favourite colour' }, options: [{ key: 'gold', label: { en: 'Gold' } }], selfEditable: true });
    expect(await fields.setValues(7, { favouriteColour: 'gold' }, { selfOnly: true })).toEqual({ favouriteColour: 'gold' });
    await expect(fields.setValues(7, { favouriteColour: 'red' })).rejects.toThrow(PersonFieldValueError);
  });

  it('refuses a self write to a field the operator did not open to the person', async () => {
    const fields = service();
    await fields.save({ key: 'birthName', type: 'text' });
    await expect(fields.setValues(7, { birthName: 'Maria' }, { selfOnly: true })).rejects.toThrow(PersonFieldValueError);
    expect(await fields.setValues(7, { birthName: 'Maria' })).toEqual({ birthName: 'Maria' });
  });

  it('writes nothing when one value in the batch is wrong', async () => {
    const fields = service();
    await fields.save({ key: 'birthName', type: 'text' });
    await fields.save({ key: 'birthDate', type: 'date' });
    await expect(fields.setValues(7, { birthName: 'Maria', birthDate: '1990-02-30' })).rejects.toThrow(PersonFieldValueError);
    expect(await fields.values(7)).toEqual({});
  });

  it('clears a value with an empty answer and drops values when the field is removed', async () => {
    const fields = service();
    await fields.save({ key: 'birthName', type: 'text' });
    await fields.setValues(7, { birthName: 'Maria' });
    expect(await fields.setValues(7, { birthName: '' })).toEqual({});
    await fields.setValues(7, { birthName: 'Maria' });
    await fields.remove('birthName');
    expect(await fields.values(7)).toEqual({});
  });

  it('reads a text answer that looks like a number back as text', async () => {
    const fields = service();
    await fields.save({ key: 'houseNumber', type: 'text' });
    expect(await fields.setValues(7, { houseNumber: '123' })).toEqual({ houseNumber: '123' });
  });

  it('refuses a key that is not a camelCase name and an unknown type', async () => {
    const fields = service();
    await expect(fields.save({ key: 'birth_name', type: 'text' })).rejects.toThrow(PersonFieldValueError);
    await expect(fields.save({ key: 'birthName', type: 'colour' })).rejects.toThrow(PersonFieldValueError);
  });
});

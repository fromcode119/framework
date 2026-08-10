import { describe, expect, it } from 'vitest';
import { DialectColumnNormalizer } from '@database/dialects/dialect-column-normalizer';

/**
 * An empty string must never reach a non-text column.
 *
 * No admin control can produce `''` for a datepicker, a number input or a toggle — an empty one means the
 * operator CLEARED the field. SQLite accepts the empty string and stores nonsense; Postgres rejects it
 * outright, so saving a person with a blank birth date died with
 * `invalid input syntax for type date: ""` and a 400. The record could not be saved at all unless some
 * unrelated date was invented, which is precisely the fabricated value this codebase forbids.
 *
 * Text columns are untouched: there `''` IS a value, and turning it into NULL would silently discard a
 * deliberate blanking of a name or a description.
 */
class TestColumnNormalizer extends DialectColumnNormalizer {
  constructor(private readonly types: Map<string, string>) {
    super();
  }

  protected async getColumnTypes(): Promise<Map<string, string>> {
    return this.types;
  }

  /** Stands in for the dialect's own coercion — identity keeps the assertions about THIS layer. */
  protected normalizeParamValue(value: any): any {
    return value;
  }
}

const normalizer = (): TestColumnNormalizer =>
  new TestColumnNormalizer(new Map([
    ['birth_date', 'DATE'],
    ['created_at', 'TIMESTAMP WITH TIME ZONE'],
    ['login_count', 'INTEGER'],
    ['balance', 'NUMERIC'],
    ['is_active', 'BOOLEAN'],
    ['external_id', 'UUID'],
    ['full_name', 'TEXT'],
    ['nickname', 'CHARACTER VARYING'],
    ['metadata', 'JSONB'],
  ]));

describe('DialectColumnNormalizer — empty string on a non-text column', () => {
  it('nulls a blank date rather than sending "" (the birth_date 400)', async () => {
    await expect(normalizer().normalizeColumnValueForWrite('users', 'birthDate', '')).resolves.toBeNull();
  });

  it('treats a whitespace-only value as cleared too', async () => {
    await expect(normalizer().normalizeColumnValueForWrite('users', 'birthDate', '   ')).resolves.toBeNull();
  });

  it('applies to every type Postgres rejects "" for', async () => {
    const subject = normalizer();
    for (const column of ['createdAt', 'loginCount', 'balance', 'isActive', 'externalId']) {
      await expect(subject.normalizeColumnValueForWrite('users', column, '')).resolves.toBeNull();
    }
  });

  it('leaves a real date value alone', async () => {
    await expect(normalizer().normalizeColumnValueForWrite('users', 'birthDate', '1990-04-17')).resolves.toBe('1990-04-17');
  });

  it('keeps "" on TEXT columns — there it is a deliberate value, not an absent one', async () => {
    await expect(normalizer().normalizeColumnValueForWrite('users', 'fullName', '')).resolves.toBe('');
    await expect(normalizer().normalizeColumnValueForWrite('users', 'nickname', '')).resolves.toBe('');
  });

  it('does not disturb JSON columns, which have their own normalization', async () => {
    await expect(normalizer().normalizeColumnValueForWrite('users', 'metadata', '')).resolves.toBe('""');
  });

  it('passes null and undefined through unchanged', async () => {
    const subject = normalizer();
    await expect(subject.normalizeColumnValueForWrite('users', 'birthDate', null)).resolves.toBeNull();
    await expect(subject.normalizeColumnValueForWrite('users', 'birthDate', undefined)).resolves.toBeUndefined();
  });

  it('clears a blank date inside a WHERE operand too, so a filter cannot send "" either', async () => {
    const where = await normalizer().normalizeWhereForTable('users', { birthDate: '', fullName: '' });
    expect(where.birthDate).toBeNull();
    expect(where.fullName).toBe('');
  });
});

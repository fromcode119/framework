import { describe, expect, it } from 'vitest';
import { BaseDialect } from '@database/dialects/base-dialect';

class DriverWithoutStrategy extends BaseDialect {}

class RecordingSqliteLike extends BaseDialect {
  readonly statements: string[] = [];
  async queryRaw(sqlText: string): Promise<Array<Record<string, unknown>>> {
    this.statements.push(sqlText);
    return [];
  }
  async withExclusiveLock<T>(_name: string, fn: () => Promise<T>): Promise<T> {
    await this.queryRaw('BEGIN IMMEDIATE');
    try {
      const result = await fn();
      await this.queryRaw('COMMIT');
      return result;
    } catch (error) {
      await this.queryRaw('ROLLBACK');
      throw error;
    }
  }
}

describe('withExclusiveLock', () => {
  it('REFUSES on a driver with no strategy, rather than running the section unprotected', async () => {
    // Silently running it would look like it worked while leaving the race wide open — and the first
    // caller is first-administrator creation.
    await expect(new DriverWithoutStrategy().withExclusiveLock('setup', async () => 'ran'))
      .rejects.toThrow(/no exclusive-lock strategy/);
  });

  it('names the guarded section in the refusal, so the log says what was at risk', async () => {
    await expect(new DriverWithoutStrategy().withExclusiveLock('fromcode.initial-admin-setup', async () => 1))
      .rejects.toThrow(/fromcode\.initial-admin-setup/);
  });

  it('commits when the section returns', async () => {
    const driver = new RecordingSqliteLike();
    await expect(driver.withExclusiveLock('setup', async () => 'made')).resolves.toBe('made');
    expect(driver.statements).toEqual(['BEGIN IMMEDIATE', 'COMMIT']);
  });

  it('rolls back and rethrows when the section fails', async () => {
    const driver = new RecordingSqliteLike();
    await expect(driver.withExclusiveLock('setup', async () => { throw new Error('insert failed'); }))
      .rejects.toThrow('insert failed');
    expect(driver.statements).toEqual(['BEGIN IMMEDIATE', 'ROLLBACK']);
  });
});

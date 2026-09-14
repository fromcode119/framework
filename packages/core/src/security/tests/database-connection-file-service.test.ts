import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { DatabaseConnectionFileService } from '@core/security/database-connection-file-service';
import { DatabaseDriverChoice } from '@core/security/enums/database-driver-choice.enum';

/**
 * Where the database connection comes from when nobody set one in the environment.
 *
 * Two properties carry real consequences and are the reason this file exists. The environment must
 * WIN, or adding a first-run wizard would quietly repoint an existing production deployment at
 * whatever a stale file happens to say. And a single connection string must be REFUSED for a driver
 * that isolates tenants: Postgres skips row-level security for a table's owner, so one role for both
 * the request path and DDL leaves the policies in place and enforcing nothing.
 */
describe('DatabaseConnectionFileService', () => {
  let dir: string;
  const APP = 'postgres://fromcode_app:app-secret@db:5432/fromcode';
  const OWNER = 'postgres://fromcode_owner:owner-secret@db:5432/fromcode';

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fc-dbconn-'));
    vi.stubEnv('DATABASE_URL', '');
    vi.stubEnv('DATABASE_MIGRATION_URL', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const writeBoth = () => DatabaseConnectionFileService.write(
    { driver: DatabaseDriverChoice.POSTGRES, runtimeUrl: APP, migrationUrl: OWNER },
    dir,
  );

  it('hands both connections to the process that had none', () => {
    writeBoth();

    expect(DatabaseConnectionFileService.adopt(dir).sort()).toEqual(['DATABASE_MIGRATION_URL', 'DATABASE_URL']);
    expect(process.env.DATABASE_URL).toBe(APP);
    expect(process.env.DATABASE_MIGRATION_URL).toBe(OWNER);
  });

  it('NEVER overrides what the deployment set — every install that exists today is this case', () => {
    writeBoth();
    vi.stubEnv('DATABASE_URL', 'postgres://someone-elses:db@production/rows');

    expect(DatabaseConnectionFileService.adopt(dir)).not.toContain('DATABASE_URL');
    expect(process.env.DATABASE_URL).toBe('postgres://someone-elses:db@production/rows');
  });

  it('adopts NOTHING when no file exists, rather than inventing a connection', () => {
    expect(DatabaseConnectionFileService.adopt(dir)).toEqual([]);
    expect(String(process.env.DATABASE_URL || '')).toBe('');
    expect(fs.existsSync(DatabaseConnectionFileService.file(dir))).toBe(false);
  });

  /**
   * The collapse this guards against is silent: `hasSeparateMigrationConnection()` answers false for
   * one URL, the app then serves requests on the role that OWNS the schema, and row-level security
   * stops applying to exactly the queries it was added for. Nothing fails; the data just mixes.
   */
  it('REFUSES one connection for a driver that isolates tenants', () => {
    expect(() => DatabaseConnectionFileService.write(
      { driver: DatabaseDriverChoice.POSTGRES, runtimeUrl: APP, migrationUrl: '' }, dir,
    )).toThrow(/refusing to write a single connection/);

    expect(() => DatabaseConnectionFileService.write(
      { driver: DatabaseDriverChoice.POSTGRES, runtimeUrl: APP, migrationUrl: APP }, dir,
    )).toThrow(/refusing to write a single connection/);

    expect(fs.existsSync(DatabaseConnectionFileService.file(dir))).toBe(false);
  });

  it('ALLOWS one connection for a driver that never isolated anything', () => {
    const file = DatabaseConnectionFileService.write(
      { driver: DatabaseDriverChoice.SQLITE, runtimeUrl: 'sqlite:///app/data/app.db', migrationUrl: '' }, dir,
    );

    expect(fs.existsSync(file)).toBe(true);
    expect(DatabaseConnectionFileService.read(dir)?.driver).toBe(DatabaseDriverChoice.SQLITE);
  });

  it('refuses a file with no runtime connection at all', () => {
    expect(() => DatabaseConnectionFileService.write(
      { driver: DatabaseDriverChoice.POSTGRES, runtimeUrl: '', migrationUrl: OWNER }, dir,
    )).toThrow(/no runtime connection/);
  });

  it('writes the file readable only by its owner — it holds two passwords', () => {
    const file = writeBoth();

    expect(fs.statSync(file).mode & 0o777).toBe(0o600);
  });

  it('counts the environment as configured, so an existing install is never asked to set up', () => {
    expect(DatabaseConnectionFileService.isConfigured(dir)).toBe(false);

    vi.stubEnv('DATABASE_URL', APP);
    expect(DatabaseConnectionFileService.isConfigured(dir)).toBe(true);
  });

  it('counts a written file as configured', () => {
    writeBoth();

    expect(DatabaseConnectionFileService.isConfigured(dir)).toBe(true);
  });

  it('treats a corrupt file as absent rather than refusing to start', () => {
    writeBoth();
    fs.writeFileSync(DatabaseConnectionFileService.file(dir), '{ not json');

    expect(DatabaseConnectionFileService.read(dir)).toBeNull();
    expect(DatabaseConnectionFileService.adopt(dir)).toEqual([]);
  });

  it('treats a file with no runtime connection as absent', () => {
    fs.writeFileSync(DatabaseConnectionFileService.file(dir), JSON.stringify({ driver: 'postgres' }));

    expect(DatabaseConnectionFileService.read(dir)).toBeNull();
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { ProjectPaths } from '@core/config/paths';
import { DatabaseConnectionFileService } from '@core/security/database-connection-file-service';
import { DatabaseDriverChoice } from '@core/security/enums/database-driver-choice.enum';
import { SetupDatabaseService } from '@core/security/setup-database-service';

/**
 * What the wizard commits to when somebody picks a driver.
 *
 * The properties worth testing are the ones whose failure is silent. Two DIFFERENT roles, or the
 * request path ends up owning the schema and row-level security stops applying to it. Two different
 * PASSWORDS, generated rather than asked for. And nothing offered that the deployment did not
 * describe — a bundled option pointing at a host that does not exist fails after the restart, with
 * nothing on screen to explain why.
 */
describe('SetupDatabaseService', () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'fc-setup-db-'));
    fs.mkdirSync(path.join(root, 'data'), { recursive: true });
    vi.stubEnv('FROMCODE_PROJECT_ROOT', root);
    (ProjectPaths as any).cachedRoot = null;
    vi.stubEnv('DATABASE_URL', '');
    vi.stubEnv('DATABASE_MIGRATION_URL', '');
    vi.stubEnv(SetupDatabaseService.BUNDLED_HOST_ENV, 'db');
    vi.stubEnv(SetupDatabaseService.BUNDLED_PORT_ENV, '5432');
    vi.stubEnv(SetupDatabaseService.BUNDLED_NAME_ENV, 'fromcode');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    (ProjectPaths as any).cachedRoot = null;
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('names two different roles with two different passwords', () => {
    SetupDatabaseService.apply({ driver: 'postgres' });
    const stored = DatabaseConnectionFileService.read()!;

    const runtime = new URL(stored.runtimeUrl);
    const owner = new URL(stored.migrationUrl);

    expect(runtime.username).toBe('fromcode_app');
    expect(owner.username).toBe('fromcode_owner');
    expect(runtime.password).not.toBe(owner.password);
    expect(runtime.password.length).toBeGreaterThanOrEqual(32);
  });

  it('points both roles at the database the deployment declared, not a guessed one', () => {
    vi.stubEnv(SetupDatabaseService.BUNDLED_HOST_ENV, 'postgres.internal');
    vi.stubEnv(SetupDatabaseService.BUNDLED_PORT_ENV, '6543');
    vi.stubEnv(SetupDatabaseService.BUNDLED_NAME_ENV, 'platform');

    SetupDatabaseService.apply({ driver: 'postgres' });
    const stored = DatabaseConnectionFileService.read()!;

    for (const url of [stored.runtimeUrl, stored.migrationUrl]) {
      const parsed = new URL(url);
      expect(parsed.hostname).toBe('postgres.internal');
      expect(parsed.port).toBe('6543');
      expect(parsed.pathname).toBe('/platform');
    }
    expect(new URL(stored.runtimeUrl).username).toBe('platform_app');
  });

  it('generates a different pair on every installation', () => {
    SetupDatabaseService.apply({ driver: 'postgres' });
    const first = DatabaseConnectionFileService.read()!.runtimeUrl;
    SetupDatabaseService.apply({ driver: 'postgres' });

    expect(DatabaseConnectionFileService.read()!.runtimeUrl).not.toBe(first);
  });

  it('offers NO bundled database when the deployment ships none, rather than guessing a host', () => {
    vi.stubEnv(SetupDatabaseService.BUNDLED_HOST_ENV, '');

    expect(SetupDatabaseService.bundledTarget()).toBeNull();
    expect(SetupDatabaseService.options().bundled).toBeNull();
    expect(() => SetupDatabaseService.apply({ driver: 'postgres' })).toThrow(/ships no bundled database/);
  });

  it('writes ONE connection for SQLite, which has no second role to write', () => {
    // `write` allows a single connection only because this driver isolates nothing; the assertion
    // that keeps that exemption honest is the PostgreSQL refusal above.
    const { driver } = SetupDatabaseService.apply({ driver: 'sqlite' });
    const stored = DatabaseConnectionFileService.read()!;

    expect(driver).toBe(DatabaseDriverChoice.SQLITE);
    expect(stored.runtimeUrl.startsWith('sqlite://')).toBe(true);
    expect(stored.migrationUrl).toBe('');
  });

  it('REFUSES a driver it cannot install yet, rather than writing something that will not boot', () => {
    expect(() => SetupDatabaseService.apply({ driver: 'mysql' })).toThrow(/can install yet/);
    expect(DatabaseConnectionFileService.read()).toBeNull();
  });

  it('refuses a driver that does not exist at all', () => {
    expect(() => SetupDatabaseService.apply({ driver: 'oracle' })).toThrow(/not a driver this platform ships/);
  });

  it('shows every driver, the unavailable one included, with what it costs', () => {
    const { drivers } = SetupDatabaseService.options();

    expect(drivers.map((d) => d.value)).toEqual(['postgres', 'sqlite', 'mysql']);
    expect(drivers.find((d) => d.value === 'postgres')).toMatchObject({ isAvailable: true, isSingleSiteOnly: false });
    expect(drivers.find((d) => d.value === 'sqlite')).toMatchObject({ isAvailable: true, isSingleSiteOnly: true });
    expect(drivers.find((d) => d.value === 'mysql')).toMatchObject({ isAvailable: false, isSingleSiteOnly: true });
  });

  it('tells the wizard where the credentials will live, so it can say so on screen', () => {
    const options = SetupDatabaseService.options();

    expect(options.connectionFile).toBe(DatabaseConnectionFileService.file());
    expect(options.connectionFile.endsWith('database.json')).toBe(true);
  });

  it('URL-encodes the credentials it builds', () => {
    SetupDatabaseService.apply({ driver: 'postgres' });
    const stored = DatabaseConnectionFileService.read()!;

    // Parsing must round-trip to the declared host: an unencoded character reshapes the URL into a
    // different machine entirely, which is the failure this guards.
    expect(new URL(stored.runtimeUrl).hostname).toBe('db');
    expect(() => new URL(stored.migrationUrl)).not.toThrow();
  });
});

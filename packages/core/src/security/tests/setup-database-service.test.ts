import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { ProjectPaths } from '@core/config/paths';
import { DatabaseConnectionFileService } from '@core/security/database-connection-file-service';
import { DatabaseDriverChoice } from '@core/security/enums/database-driver-choice.enum';
import { SetupDatabaseService } from '@core/security/setup-database-service';
import { FrameworkRootLocator } from '@core/config/framework-root-locator';

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
    FrameworkRootLocator.forget();
    vi.stubEnv('DATABASE_URL', '');
    vi.stubEnv('DATABASE_MIGRATION_URL', '');
    vi.stubEnv(SetupDatabaseService.BUNDLED_HOST_ENV, 'db');
    vi.stubEnv(SetupDatabaseService.BUNDLED_PORT_ENV, '5432');
    vi.stubEnv(SetupDatabaseService.BUNDLED_NAME_ENV, 'fromcode');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    FrameworkRootLocator.forget();
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

  /**
   * Every driver can be installed now, so the refusal that matters is a different one: pointing a
   * driver at the bundled server when that server speaks a different protocol. The connection would
   * be written, the restart would happen, and the error would name neither the driver nor the server.
   */
  it('REFUSES a driver the bundled server does not speak, rather than writing a connection that cannot work', () => {
    expect(() => SetupDatabaseService.apply({ driver: 'mysql' })).toThrow(/bundled database is postgres, not mysql/);
    expect(DatabaseConnectionFileService.read()).toBeNull();
  });

  it('refuses a driver that does not exist at all', () => {
    expect(() => SetupDatabaseService.apply({ driver: 'oracle' })).toThrow(/not a driver this platform ships/);
  });

  it('shows every driver with what it costs and what it needs', () => {
    const { drivers } = SetupDatabaseService.options();

    expect(drivers.map((d) => d.value)).toEqual(['postgres', 'sqlite', 'mysql']);
    expect(drivers.find((d) => d.value === 'postgres')).toMatchObject({ isAvailable: true, isSingleSiteOnly: false });
    expect(drivers.find((d) => d.value === 'sqlite')).toMatchObject({ isAvailable: true, isSingleSiteOnly: true });
    // MySQL is installable, but only against a server the operator names — the bundled one is
    // PostgreSQL, and `hasBundledServer` is what the wizard reads to decide which form to show.
    expect(drivers.find((d) => d.value === 'mysql'))
      .toMatchObject({ isAvailable: true, isSingleSiteOnly: true, hasBundledServer: false });
    expect(drivers.find((d) => d.value === 'postgres')).toMatchObject({ hasBundledServer: true });
  });

  it('tells the wizard where the credentials will live, so it can say so on screen', () => {
    const options = SetupDatabaseService.options();

    expect(options.connectionFile).toBe(DatabaseConnectionFileService.file());
    expect(options.connectionFile.endsWith('database.json')).toBe(true);
  });

  /**
   * A database the operator already runs. This is the only route for a driver the deployment ships
   * no server for, and the isolation rule is the whole reason it cannot be a single form field.
   */
  describe('a server the operator runs', () => {
    const server = {
      host: 'db.internal', port: 6543, database: 'platform',
      user: 'app_role', password: 'app-pass',
      ownerUser: 'owner_role', ownerPassword: 'owner-pass',
    };

    it('writes both roles, pointed at the server that was named', () => {
      SetupDatabaseService.apply({ driver: 'postgres', server });
      const stored = DatabaseConnectionFileService.read()!;

      expect(new URL(stored.runtimeUrl).username).toBe('app_role');
      expect(new URL(stored.migrationUrl).username).toBe('owner_role');
      expect(new URL(stored.runtimeUrl).hostname).toBe('db.internal');
      expect(new URL(stored.runtimeUrl).port).toBe('6543');
    });

    it('REFUSES a driver that isolates without a second, schema-owning role', () => {
      expect(() => SetupDatabaseService.apply({
        driver: 'postgres', server: { ...server, ownerUser: '' },
      })).toThrow(/needs a second, schema-owning role/);

      expect(DatabaseConnectionFileService.read()).toBeNull();
    });

    it('needs no owner role for a driver that isolates nothing', () => {
      SetupDatabaseService.apply({ driver: 'sqlite', server: { ...server, ownerUser: '' } });

      expect(DatabaseConnectionFileService.read()!.migrationUrl).toBe('');
    });

    it('falls back to the driver\'s own port rather than inventing one', () => {
      SetupDatabaseService.apply({ driver: 'postgres', server: { ...server, port: undefined } });

      expect(new URL(DatabaseConnectionFileService.read()!.runtimeUrl).port).toBe('5432');
    });

    it('encodes a password that would otherwise reshape the URL', () => {
      SetupDatabaseService.apply({ driver: 'postgres', server: { ...server, password: 'p@ss/word' } });
      const parsed = new URL(DatabaseConnectionFileService.read()!.runtimeUrl);

      expect(parsed.hostname).toBe('db.internal');
      expect(decodeURIComponent(parsed.password)).toBe('p@ss/word');
    });

    it.each(['host', 'database', 'user'])('refuses a server with no %s', (field) => {
      expect(() => SetupDatabaseService.apply({
        driver: 'postgres', server: { ...server, [field]: '' },
      })).toThrow(new RegExp(`the ${field} is required`));
    });
  });

  it('REFUSES a driver the bundled server does not speak, rather than pointing it at the wrong one', () => {
    // The compose ships PostgreSQL. Building a mysql:// URL against that container would connect to
    // a server that does not speak the protocol, and the error would name neither.
    expect(() => SetupDatabaseService.apply({ driver: 'mysql' }))
      .toThrow(/bundled database is postgres, not mysql|can install yet/);
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

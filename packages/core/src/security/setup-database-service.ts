import crypto from 'crypto';
import path from 'path';
import { ProjectPaths } from '@core/config/paths';
import { DatabaseConnectionFileService } from '@core/security/database-connection-file-service';
import { DatabaseDriverChoice } from '@core/security/enums/database-driver-choice.enum';

/**
 * Turns "which database" — the one question the first-run wizard asks before anything exists — into
 * the two connection strings the platform runs on.
 *
 * NOTHING HERE IS INVENTED. The bundled database's host, port and name are values the deployment
 * declares (the compose file names its own `db` service); the role names are derived from the
 * database name in the open, and the wizard SHOWS all of them before anything is written. Nothing
 * is offered that the deployment did not describe: with no bundled database declared, the bundled
 * option is not presented at all rather than pointing at a guessed hostname.
 *
 * TWO ROLES, ALWAYS, for a driver that isolates. The names are not configuration — they are read
 * back out of the connection strings by `DatabaseRoleBootstrapService`, which is what actually
 * creates the logins on the next boot, so a separate setting for them could only ever disagree with
 * the connection actually used.
 *
 * THE PASSWORDS ARE GENERATED, NOT ASKED FOR. A person inventing two database passwords during an
 * install produces something worse than a CSPRNG does, and has nowhere to put them; these are
 * written to the connection file and never shown, because nothing needs to type them again.
 */
export class SetupDatabaseService {
  /**
   * Where a bundled database lives, when the deployment ships one.
   *
   * These are container-internal coordinates, which is why they are allowed to be environment: the
   * `db` service's name on the compose network is not a URL anybody has to own or maintain, and it
   * is the one thing the api cannot derive for itself.
   */
  static readonly BUNDLED_HOST_ENV = 'BUNDLED_DATABASE_HOST';
  static readonly BUNDLED_PORT_ENV = 'BUNDLED_DATABASE_PORT';
  static readonly BUNDLED_NAME_ENV = 'BUNDLED_DATABASE_NAME';
  /** Which driver the bundled server speaks. Defaults to postgres, which is what the compose ships. */
  static readonly BUNDLED_DRIVER_ENV = 'BUNDLED_DATABASE_DRIVER';

  /** 64 hex characters. Never shown, never typed, and never the same on two installations. */
  private static readonly PASSWORD_BYTES = 32;

  /**
   * The bundled database this deployment ships, or null when it ships none.
   *
   * Null is the honest answer for a deployment whose compose file defines no `db` service: pointing
   * the wizard at a host that does not exist would fail at the restart with nothing to explain it.
   */
  static bundledTarget(): IBundledDatabaseTarget | null {
    const host = String(process.env[SetupDatabaseService.BUNDLED_HOST_ENV] || '').trim();
    const name = String(process.env[SetupDatabaseService.BUNDLED_NAME_ENV] || '').trim();
    if (!host || !name) return null;

    const port = Number(String(process.env[SetupDatabaseService.BUNDLED_PORT_ENV] || '').trim());
    return {
      // The bundled server is whatever the deployment's compose file actually runs. Declared rather
      // than assumed, so a wizard cannot offer a driver against a server that does not speak it.
      driver: String(process.env[SetupDatabaseService.BUNDLED_DRIVER_ENV] || 'postgres').trim().toLowerCase(),
      host,
      port: Number.isFinite(port) && port > 0 ? port : 5432,
      database: name,
      ownerRole: `${name}_owner`,
      runtimeRole: `${name}_app`,
    };
  }

  /**
   * Everything the wizard puts on screen before the operator commits to anything.
   *
   * Deliberately includes the drivers that cannot be chosen and the reason they cannot: a driver
   * that is simply missing from a list reads as one that does not exist.
   */
  static options(): ISetupDatabaseOptions {
    return {
      drivers: DatabaseDriverChoice.ordered.map((driver) => ({
        value: driver.value,
        isAvailable: driver.isAvailable,
        isSingleSiteOnly: driver.isSingleSiteOnly,
        // Whether this deployment ships a server speaking it, so nothing has to be typed. A driver it
        // does not speak is still choosable — it just needs a server the operator names.
        hasBundledServer: driver.value === (SetupDatabaseService.bundledTarget()?.driver ?? ''),
        // A driver that isolates needs a SECOND, schema-owning role, so the form must ask for one.
        needsOwnerRole: driver.isolatesTenants,
        defaultPort: SetupDatabaseService.defaultPort(driver),
      })),
      bundled: SetupDatabaseService.bundledTarget(),
      sqliteFile: SetupDatabaseService.sqliteFile(),
      connectionFile: DatabaseConnectionFileService.file(),
    };
  }

  /**
   * Write the connection for the chosen driver, and return where it went.
   *
   * The roles it names do not exist yet: they are created on the NEXT boot by the entrypoint, which
   * holds the privileged credential this process deliberately never sees. So this writes a file and
   * nothing more — the caller's job is to end the process so that boot happens.
   */
  static apply(input: ISetupDatabaseRequest): { file: string; driver: DatabaseDriverChoice } {
    const driver = DatabaseDriverChoice.from(input.driver);

    if (!driver.isAvailable) {
      throw new Error(`SetupDatabaseService: "${driver.value}" is not a driver this platform can install yet.`);
    }

    // A server the operator already runs. This is the ONLY route for a driver the deployment ships
    // no server for — MySQL, or a PostgreSQL somewhere else — and the roles are theirs to have
    // created, because nothing here holds a credential privileged enough to create them.
    if (input.server) {
      return { file: SetupDatabaseService.applyExternal(driver, input.server), driver };
    }

    if (driver === DatabaseDriverChoice.SQLITE) {
      const file = DatabaseConnectionFileService.write({
        driver,
        runtimeUrl: `sqlite://${SetupDatabaseService.sqliteFile()}`,
        // One file, one process, no roles to separate — and no row-level security that a second
        // role could have protected. `write` allows this only because the driver isolates nothing.
        migrationUrl: '',
      });
      return { file, driver };
    }

    const bundled = SetupDatabaseService.bundledTarget();
    if (!bundled) {
      throw new Error('SetupDatabaseService: this deployment ships no bundled database to configure.');
    }
    if (driver.value !== bundled.driver) {
      throw new Error(
        `SetupDatabaseService: the bundled database is ${bundled.driver}, not ${driver.value}. `
        + 'Point this installation at a server you run instead.',
      );
    }

    const file = DatabaseConnectionFileService.write({
      driver,
      runtimeUrl: SetupDatabaseService.url(driver, bundled, bundled.runtimeRole),
      migrationUrl: SetupDatabaseService.url(driver, bundled, bundled.ownerRole),
    });
    return { file, driver };
  }

  /**
   * Write the connection for a server the operator already runs.
   *
   * TWO ROLES OR ONE, AND THE DIFFERENCE IS STATED RATHER THAN GUESSED. A driver that isolates
   * tenants needs the request path to run as a role that owns nothing, so `ownerUser` is required
   * there and `DatabaseConnectionFileService.write` refuses the file otherwise. A driver that
   * isolates nothing has no second role to want.
   *
   * Nothing is created here. These roles exist already or they do not; this process holds no
   * credential that could make them, which is exactly why the bundled path goes through the
   * entrypoint instead.
   */
  private static applyExternal(driver: DatabaseDriverChoice, server: IExternalDatabaseServer): string {
    const host = String(server.host || '').trim();
    const database = String(server.database || '').trim();
    const user = String(server.user || '').trim();

    for (const [label, value] of [['host', host], ['database', database], ['user', user]]) {
      if (!value) throw new Error(`SetupDatabaseService: the ${label} is required for a database you run yourself.`);
    }

    const port = Number(server.port) > 0 ? Number(server.port) : SetupDatabaseService.defaultPort(driver);
    const runtimeUrl = SetupDatabaseService.externalUrl(driver, { host, port, database }, user, String(server.password ?? ''));

    const ownerUser = String(server.ownerUser || '').trim();
    if (driver.isolatesTenants && !ownerUser) {
      throw new Error(
        `SetupDatabaseService: ${driver.value} needs a second, schema-owning role. `
        + 'Serving requests as the role that owns the tables disables row-level security silently.',
      );
    }

    return DatabaseConnectionFileService.write({
      driver,
      runtimeUrl,
      migrationUrl: ownerUser
        ? SetupDatabaseService.externalUrl(driver, { host, port, database }, ownerUser, String(server.ownerPassword ?? ''))
        : '',
    });
  }

  /** The port a driver listens on when the operator did not say. Stated, not guessed at connect time. */
  static defaultPort(driver: DatabaseDriverChoice): number {
    return driver === DatabaseDriverChoice.MYSQL ? 3306 : 5432;
  }

  private static externalUrl(
    driver: DatabaseDriverChoice,
    target: { host: string; port: number; database: string },
    user: string,
    password: string,
  ): string {
    // Encoded, because these are values a person typed: an unencoded `@` or `/` in a password
    // silently reshapes the URL into a different host.
    return `${driver.value}://${encodeURIComponent(user)}:${encodeURIComponent(password)}`
      + `@${target.host}:${target.port}/${target.database}`;
  }

  /** Where a SQLite installation would keep its one file — inside the mounted data directory. */
  static sqliteFile(): string {
    return path.join(ProjectPaths.getDataDir(), 'platform.db');
  }

  /**
   * A connection string with a freshly generated password, URL-encoded.
   *
   * Encoding matters more than it looks: a generated password is hex here, but the same builder is
   * what an external-database form would use, and an unencoded `@` or `/` silently reshapes the URL
   * into a different host.
   */
  private static url(driver: DatabaseDriverChoice, target: IBundledDatabaseTarget, role: string): string {
    const password = crypto.randomBytes(SetupDatabaseService.PASSWORD_BYTES).toString('hex');
    const user = encodeURIComponent(role);
    return `${driver.value}://${user}:${encodeURIComponent(password)}@${target.host}:${target.port}/${target.database}`;
  }
}

/** A database the deployment ships with itself, described by the deployment rather than guessed. */
export interface IBundledDatabaseTarget {
  /** The driver this server speaks — a wizard must not offer a different one against it. */
  readonly driver: string;
  readonly host: string;
  readonly port: number;
  readonly database: string;
  readonly ownerRole: string;
  readonly runtimeRole: string;
}

/** A database the operator already runs, described by them. Nothing here is created by this platform. */
export interface IExternalDatabaseServer {
  readonly host: string;
  readonly port?: number | string;
  readonly database: string;
  /** The role that SERVES REQUESTS. On a driver that isolates, it must own nothing. */
  readonly user: string;
  readonly password?: string;
  /** The role that owns the schema and runs migrations. Required wherever isolation is real. */
  readonly ownerUser?: string;
  readonly ownerPassword?: string;
}

/** What the wizard posts. `server` present means "a database I run"; absent means the bundled one. */
export interface ISetupDatabaseRequest {
  readonly driver: unknown;
  readonly server?: IExternalDatabaseServer;
}

/** What the wizard shows. Every field here appears on screen before anything is committed. */
export interface ISetupDatabaseOptions {
  readonly drivers: Array<{
    value: string;
    isAvailable: boolean;
    isSingleSiteOnly: boolean;
    hasBundledServer: boolean;
    needsOwnerRole: boolean;
    defaultPort: number;
  }>;
  readonly bundled: IBundledDatabaseTarget | null;
  readonly sqliteFile: string;
  readonly connectionFile: string;
}

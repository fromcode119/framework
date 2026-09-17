import fs from 'fs';
import path from 'path';
import { ProjectPaths } from '@core/config/paths';
import { DatabaseDriverChoice } from '@core/security/enums/database-driver-choice.enum';
import type { IDatabaseConnectionFile } from '@core/security/interfaces/database-connection-file.interface';
import type { IStoredDatabaseConnection } from '@core/security/interfaces/stored-database-connection.interface';

/**
 * Where a deployment's database connection comes from when nobody put one in the environment.
 *
 * This is the database half of what {@link BootstrapSecretsService} does for secrets, and it exists
 * for the same reason: asking a person to hand-write five connection variables into a file before
 * anything will start is the step that ends an installation. The first-run wizard writes them here
 * instead, and every later boot reads them back.
 *
 * ENV ALWAYS WINS, and that is what makes this safe to add to an existing platform. A deployment
 * that sets `DATABASE_URL` — every deployment that exists today — never reads this file, never
 * writes it, and behaves exactly as it did. {@link adopt} only fills in what was left empty.
 *
 * TWO ROLES OR NOTHING. `write` REFUSES a single connection string for a driver that isolates
 * tenants. Postgres skips row-level security for the owner of a table and for any superuser, so a
 * deployment whose request path and DDL path are the same role has policies that look present and
 * enforce nothing — and `DatabaseConnectionUrls.hasSeparateMigrationConnection()` collapses to the
 * single connection silently. A file that could express that collapse would be a way to destroy
 * tenant isolation by accident, so it cannot be written in the first place.
 *
 * WHAT IS DELIBERATELY NOT HERE: the privileged bootstrap credential. The roles are created by the
 * container entrypoint, as root, before the application process exists; it reads that credential
 * from its own root-owned file and unsets it before exec. Keeping it out of this file is the point —
 * this one is readable by the account the application runs as.
 */
export class DatabaseConnectionFileService {
  private static readonly FILE_NAME = 'database.json';

  /**
   * Fill in the connection variables the environment did not supply, and return which ones came
   * from the file.
   *
   * Call this BEFORE anything resolves a connection — before `PluginManager`, which opens one in its
   * constructor.
   */
  static adopt(directory: string = ProjectPaths.getDataDir()): string[] {
    const stored = DatabaseConnectionFileService.read(directory);
    if (!stored) return [];

    const adopted: string[] = [];
    const values: Record<string, string> = {
      DATABASE_URL: stored.runtimeUrl,
      DATABASE_MIGRATION_URL: stored.migrationUrl,
    };

    for (const [key, value] of Object.entries(values)) {
      if (String(process.env[key] || '').trim()) continue;
      if (!String(value || '').trim()) continue;
      process.env[key] = value;
      adopted.push(key);
    }
    return adopted;
  }

  /**
   * Has this deployment been told where its database is — by either route?
   *
   * The environment counts, so an existing install is "configured" without ever having a file, and
   * the setup wizard never asks it a question it already has the answer to.
   */
  static isConfigured(directory: string = ProjectPaths.getDataDir()): boolean {
    if (String(process.env.DATABASE_URL || '').trim()) return true;
    return DatabaseConnectionFileService.read(directory) !== null;
  }

  /**
   * What the wizard stored, or null. Never throws: an unreadable file is treated as absent.
   *
   * `driver` comes back parsed, and `undefined` when the file names one this build does not ship —
   * which is NOT a reason to ignore the connection. The dialect is resolved from the URL's scheme
   * either way, so the stored name is a record of what was chosen, never the thing that decides.
   */
  static read(directory: string = ProjectPaths.getDataDir()): IStoredDatabaseConnection | null {
    try {
      const raw = fs.readFileSync(DatabaseConnectionFileService.file(directory), 'utf8');
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      const runtimeUrl = String(parsed.runtimeUrl || '').trim();
      if (!runtimeUrl) return null;
      return {
        driver: DatabaseDriverChoice.parse(parsed.driver),
        runtimeUrl,
        migrationUrl: String(parsed.migrationUrl || '').trim(),
      };
    } catch {
      return null;
    }
  }

  /**
   * Record where the database is. Written once, by the wizard, and then only read.
   *
   * Refuses a driver that isolates tenants unless BOTH roles are present and different — see the
   * class docblock. The caller is expected to surface that refusal, not swallow it: it means the
   * wizard tried to provision something that could not have isolated anything.
   */
  static write(input: IDatabaseConnectionFile, directory: string = ProjectPaths.getDataDir()): string {
    const runtimeUrl = String(input.runtimeUrl || '').trim();
    const migrationUrl = String(input.migrationUrl || '').trim();

    if (!runtimeUrl) {
      throw new Error('DatabaseConnectionFileService: refusing to write a file with no runtime connection.');
    }

    if (DatabaseDriverChoice.from(input.driver).isolatesTenants && (!migrationUrl || migrationUrl === runtimeUrl)) {
      throw new Error(
        `DatabaseConnectionFileService: refusing to write a single connection for "${input.driver}". `
        + 'The request path must run as a role that owns nothing, or row-level security does not apply '
        + 'to it and tenant isolation silently stops existing.',
      );
    }

    const file = DatabaseConnectionFileService.file(directory);
    const payload: IDatabaseConnectionFile = { driver: input.driver, runtimeUrl, migrationUrl };

    fs.mkdirSync(directory, { recursive: true });
    // Written through a temporary file and renamed, so a crash mid-write cannot leave a truncated
    // file that the next boot would read as "no database" and offer to set up again.
    const temporary = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(temporary, `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o600 });
    fs.renameSync(temporary, file);
    fs.chmodSync(file, 0o600);
    return file;
  }

  /** The path, so the wizard can SHOW the operator where their credentials now live. */
  static file(directory: string = ProjectPaths.getDataDir()): string {
    return path.join(directory, DatabaseConnectionFileService.FILE_NAME);
  }
}

